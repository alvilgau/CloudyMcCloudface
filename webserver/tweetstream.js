require('dotenv').config();
const request = require('request');
const amqp = require('amqplib/callback_api');

let channel = null;
let stream = null;
// key = keyword, value=number of registrations for this keyword
const registrations = {};
let needReconnect = false;

const installErrorHandler = function (s) {
  s.on('error', (err) => {
    console.log('ERROR', err);
  });
};

const installResponseHandler = function (s) {
  s.on('response', (res) => {
    let tweet = '';
    res.on('data', (bytes) => {
      // we received a new chunk from twitter
      const chunk = bytes.toString();
      // check if chunk contains a new tweet (tweets are separated by '\r\n')
      if (chunk.includes('\r\n')) {
        const splitted = chunk.split('\r\n');
        // first part belongs to 'current' tweet
        tweet += splitted[0];
        try {
          // publish tweet
          const tweetAsJson = JSON.parse(tweet);
          channel.sendToQueue('tweets', Buffer.from(tweetAsJson.text));
        } catch (ignored) { /* should never happen */ }
        // now the new tweet message
        tweet = splitted[1];
      } else {
        // the whole chunk belongs to the current tweet
        tweet += chunk;
      }
    });
  });
};

const createTwitterStream = function () {
  const s = request.post({
    url: 'https://stream.twitter.com/1.1/statuses/filter.json?filter_level=none&stall_warnings=true',
    oauth: {
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      token: process.env.TWITTER_TOKEN,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      token_secret: process.env.TWITTER_TOKEN_SECRET,
    },
    form: {
      track: Object.keys(registrations).join(),
    },
  });
  return s;
};

const connectToTwitter = function () {
  stream = createTwitterStream();
  installErrorHandler(stream);
  installResponseHandler(stream);
};

const handleRegisterMessage = function (msg) {
  const keyword = msg.keyword;
  // check if keyword is already tracked
  if (registrations[keyword] === null) {
    // keyword isn't tracked yet
    registrations[keyword] = 0;
    // reconnect to the twitter stream to track the new keyword
    needReconnect = true;
  }
  // increment registration counter for this keyword
  registrations[keyword] += 1;

  console.log(`received registration for keyword: ${keyword}`);
};

const handleUnregisterMessage = function (msg) {
  const keyword = msg.keyword;
  // check if there is a registration for the given keyword
  if (registrations[keyword] !== null) {
    // decrement registration counter for this keyword
    registrations[keyword] -= 1;
    // check if any other client is still interested
    if (registrations[keyword] === 0) {
      // no other client is interested in the keyword
      // make a reconnect to decrease traffic
      delete registrations[keyword];
      needReconnect = true;
    }
  }

  console.log(`received unregistration for keyword: ${keyword}`);
};

const reconnect = function () {
  // when we received new keywords, we have to create a new connection to twitter
  // but we dont want to do this too often because we are afraid of being blocked!
  const timeoutInSeconds = 15;
  setInterval(() => {
    // check if we really need to reconnect
    if (needReconnect) {
      needReconnect = false;
      console.log(`reconnect to twitter: ${Object.keys(registrations).join()}`);
      // close current stream and connect again
      stream.abort();
      connectToTwitter();
    } else {
      console.log('no need to reconnect');
    }
  }, timeoutInSeconds * 1000);
};

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
  // create a channel to publish the tweets from twitter stream
  conn.createChannel((err, ch) => {
    channel = ch;
    channel.assertQueue('tweets', { durable: false });
    connectToTwitter();
    reconnect();
  });

  // create an exchange for keyword observation
  conn.createChannel((err, ch) => {
    ch.assertExchange('keywords', 'fanout', { durable: true });
    ch.assertQueue('', { exclusive: true }, (err, q) => {
      ch.bindQueue(q.queue, 'keywords', '');
      ch.consume(q.queue, (msg) => {
        const message = JSON.parse(msg.content);
        if (message.type === 'register') {
          handleRegisterMessage(message);
        } else if (message.type === 'unregister') {
          handleUnregisterMessage(message);
        }
      }, { noAck: true });
    });
  });
});

