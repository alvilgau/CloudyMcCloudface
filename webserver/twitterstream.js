require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const request = require('request');
const amqp = require('amqplib');

var channel = null;
var stream = null;
const q = 'tweets';
const keywords = ['trump'];

const installErrorHandler = function(stream) {
    stream.on('error', (err) => {
        console.log('ERROR', err);
    });
};

const installResponseHandler = function(stream) {
    stream.on('response', (res) => {
        var tweet = ''; 
        res.on('data', (chunk) => {
            const str = chunk.toString();
            if (str.includes('\r\n'))  {
                const splitted = str.split('\r\n');
                tweet += splitted[0];
                try {
                    const tweetAsJson = JSON.parse(tweet);                    
                    channel.sendToQueue(q, Buffer.from(tweetAsJson.text));                    
                } catch (ignored) {}            
                tweet = splitted[1];                             
            } else {
                tweet += str;
            }
        });
    });
};

const connectToTwitter = function() {
    const twitterConfig = {
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        token: process.env.TWITTER_TOKEN,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        token_secret: process.env.TWITTER_TOKEN_SECRET
    };    
    var stream = request.post({
        url: 'https://stream.twitter.com/1.1/statuses/filter.json?filter_level=none&stall_warnings=true',
        oauth: twitterConfig,
        form: {
            track: keywords.join(',')
        }
    });
    return stream;
}

amqp.connect(process.env.RABBITMQ_URL)
    .then((conn) => {
        return conn.createChannel();
    })
    .then((ch) => {
        channel = ch;
        channel.assertQueue(q, {durable: false});        
        stream = connectToTwitter();
        installErrorHandler(stream);
        installResponseHandler(stream);
    })
    .catch((err) => {
        console.log(err);
    });
