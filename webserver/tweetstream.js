require('dotenv').config();
const https = require('https');
const crypto = require('crypto');
const request = require('request');
const amqp = require('amqplib');

var channel = null;
var stream = null;
const q = 'tweets';
const keywords = ['trump'];
var receivedNewKeywords = false;

const installErrorHandler = function (stream) {
    stream.on('error', (err) => {
        console.log('ERROR', err);
    });
};

const installResponseHandler = function (stream) {
    stream.on('response', (res) => {
        var tweet = '';
        res.on('data', (chunk) => {
            // we received a new chunk from twitter
            const str = chunk.toString();
            // check if check contains a new tweet (tweets are separated by '\r\n')
            if (str.includes('\r\n')) {                
                const splitted = str.split('\r\n');
                // first part belongs to 'current' tweet
                tweet += splitted[0];
                try {
                    // publish tweet
                    const tweetAsJson = JSON.parse(tweet);
                    channel.sendToQueue(q, Buffer.from(tweetAsJson.text));
                } catch (ignored) { /* should never happen */ }
                // now the new tweet message
                tweet = splitted[1];
            } else {
                // the whole chunk belongs to the current tweet
                tweet += str;
            }
        });
    });
};

const createTwitterStream = function () {
    var stream = request.post({
        url: 'https://stream.twitter.com/1.1/statuses/filter.json?filter_level=none&stall_warnings=true',
        oauth: {
            consumer_key: process.env.TWITTER_CONSUMER_KEY,
            token: process.env.TWITTER_TOKEN,
            consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
            token_secret: process.env.TWITTER_TOKEN_SECRET
        },
        form: {
            track: keywords.join(',')
        }
    });
    return stream;
};

const connectToTwitter = function() {
    stream = createTwitterStream();
    installErrorHandler(stream);
    installResponseHandler(stream);
};

amqp.connect(process.env.RABBITMQ_URL)
    .then((conn) => {
        return conn.createChannel();
    })
    .then((ch) => {
        channel = ch;
        channel.assertQueue(q, { durable: false });
        connectToTwitter();        
        reconnect();
    })
    .catch((err) => {
        console.log(err);
    });

const reconnect = function() {
    // when we received new keywords, we have to create a new connection to twitter
    // but we dont want to do this to often because we are afraid of being blocked!
    const timeoutInSeconds = 30;
    setInterval(() => {        
        if (receivedNewKeywords) {
            console.log('reconnect to twitter...');
            stream.abort();
            connectToTwitter();
        }
    }, timeoutInSeconds * 1000);
};

