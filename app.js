var sys = require('sys'),
    express = require('express'),
    TwilioClient = require('twilio/client'),
    Twiml = require('twilio/twiml'),
    gm = require('googlemaps'),
    RedisClient = require('redis'),
    config = require('./config'),
    client = new TwilioClient(config.sid, config.authToken, config.hostname),
    phone = client.getPhoneNumber(config.phoneNumber, {noVoice: true}),
    redis = RedisClient.createClient();

redis.on('error', function(err) {
    console.log('Redis connection error');
});

redis.setnx('texts:count', 0);

phone.setup(function() {
    phone.on('incomingSms', function(smsParams, res) {
        var sms = {
            text: smsParams.Body,
            from: smsParams.From,
            date: (new Date()).toString(),
            location: {}
        },
            address = '',
            space = '';

        if(smsParams.FromCity) {
            sms.location.city = smsParams.FromCity;
            address += sms.location.city;
            space = ' ';
        }

        if(smsParams.FromState) {
            sms.location.state = smsParams.FromState;
            address += space + sms.location.state;
            space = ' ';
        }

        if(smsParams.FromZip) {
            sms.location.zip = smsParams.FromZip;
            address += space + sms.location.zip;
            space = ' ';
        }

        if(smsParams.FromCountry) {
            sms.location.country = smsParams.FromCountry;
            address += space + sms.location.country;
        }
        
        res.append(new Twiml.Sms('Thanks! We\'re mapping your text right now. Have fun!'));
        res.send();
        
        gm.geocode(address, function(err, res) {
            if(err) {
                console.log('Error geocoding ' + address);
                console.log(err);
                return;
            }
            
            if(res && res.results && res.results[0] && res.results[0].geometry) {
                sms.location.lat = res.results[0].geometry.location.lat;
                sms.location.lng = res.results[0].geometry.location.lng;

                console.log('Storing text in redis.');
                redis.get('texts:count', function(err, res) {
                    var curTextIndex = res;

                    console.log('There are ' + curTextIndex + ' texts in redis. Adding one');

                    redis.set('texts:' + curTextIndex, JSON.stringify(sms));
                    redis.incr('texts:count');
                });
            };
        });
    });
});

var app = express.createServer();

app.configure(function() {
    app.use(express.logger());
});

app.get('/pins', function(req, response) {
    redis.get('texts:count', function(err, res) {
        if(err) {
            console.log('Redis error');
            console.log(err);
            return;
        }
        
        var numTexts = res;
        console.log('Got ' + numTexts + ' text count');
        texts = [];

        for(var i = 0; i < numTexts; i++) {
            console.log('Getting texts:' + i);

            redis.get('texts:' + i, (function(index) {
                return function(err, result) {
                    console.log('Finished get. Got res: ' + result);
                    if(err) {
                        console.log('Redis error getting text:' + index);
                        console.log(err);
                        texts.push(null);
                    } else {
                        texts.push(JSON.parse(result));
                    }

                    if(texts.length == numTexts) {
                        response.send(texts);
                    }
                };
            })(i));
        };
    });
});

app.use(express.staticProvider(__dirname + '/static'), {cache: true});

// We use NGINX proxypassthrough to get to us.
app.listen(9001);
