var express = require('express'),
    TwilioClient = require('twilio/client'),
    Twiml = require('twilio/twiml'),
    config = require('./config'),
    client = new TwilioClient(config.sid, config.authToken, config.hostname),
    phone = client.getPhoneNumber(config.phoneNumber, {noVoice: true});

phone.setup(function() {
    phone.on('incomingSms', function(smsParams, res) {
        var sms = {
            text: smsParams.Body,
            from: smsParams.From,
            location: {}
        };

        if(smsParams.FromCity) {
            sms.location.city = smsParams.FromCity;
        }

        if(smsParams.FromState) {
            sms.location.state = smsParams.FromState;
        }

        if(smsParams.FromZip) {
            sms.location.zip = smsParams.FromZip;
        }

        if(smsParams.FromCountry) {
            sms.location.country = smsParams.FromCountry;
        }

        res.append(new Twiml.Sms('Thanks! We\'re mapping your text right now. Have fun!'));
        res.send();

        // Store the text
    });
});

