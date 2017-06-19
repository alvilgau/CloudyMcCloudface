require('dotenv').config();
const request = require('request');
const _ = require('lodash');

const twitterUrl = process.env.TWITTER_URL;

// number of tweets to collect (per keyword) before analysis starts
const threshold = 10;

const handleNewTweet = function (stream, tweet) {
  const keywords = stream.keywords
    .sort((a, b) => b.length - a.length)
    .filter(kw => tweet.toLowerCase().includes(kw));
  const tweets = stream.tweets;
  keywords.forEach(keyword => {
    // create key for keyword if not already exists
    if (!tweets[keyword]) {
      tweets[keyword] = [];
    }
    // store tweet
    tweets[keyword].push(tweet);
  });

  // analyze Tweets every 3 seconds
  if (Date.now() - tweets.__lastAnalysis > 3000) {
    tweets.__lastAnalysis = Date.now();
    stream.keywords
      .forEach(keyword => {
        if (tweets[keyword].length > 0) {
          stream.handleTweets(keyword, tweets[keyword]);
          tweets[keyword] = [];
        }
      });
  }
};

const installErrorHandler = function (stream) {
  stream.connection.on('error', (err) => {
    console.error(err);
  });
};

const installResponseHandler = function (stream) {
  stream.connection.on('response', (res) => {
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
          if (tweetAsJson.text) {
            handleNewTweet(stream, tweetAsJson.text);
          }
        } catch (ignored) { /* should never happen */
        }
        // now the new tweet message
        tweet = splitted[1];
      } else {
        // the whole chunk belongs to the current tweet
        tweet += chunk;
      }
    });
  });
};

const createTwitterStream = (tenant, keywords) => request.post({
  url: twitterUrl,
  oauth: {
    consumer_key: tenant.consumerKey,
    token: tenant.token,
    consumer_secret: tenant.consumerSecret,
    token_secret: tenant.tokenSecret,
  },
  form: {
    track: keywords.join(),
  }
});

const connectToTwitter = (stream) => {
  stream.connection = createTwitterStream(stream.tenant, stream.keywords);
  installErrorHandler(stream);
  installResponseHandler(stream);
};

const startPeriodicReconnect = (stream) => {
  setInterval(() => {
    // check if we really need to reconnect
    if (stream.needReconnect) {
      stream.needReconnect = false;
      console.log(`reconnect to twitter: ${stream.keywords.join()}`);
      // close current stream and connect again
      stopStream(stream);
      connectToTwitter(stream);
    } else {
      console.log('no need to reconnect');
    }
  }, process.env.TWITTER_RECONNECT_INTERVAL * 1000);
};

const onTweets = (stream, tweetHandler) => {
  stream.handleTweets = tweetHandler;
};

const setKeywords = (stream, keywords) => {
  const needReconnect = !_.isEqual(stream.keywords.sort(), keywords.sort());
  if (needReconnect) {
    stream.needReconnect = true;
  }
  stream.keywords = keywords;
};

const startStream = (tenant) => {
  const stream = {
    tweets: {
      __lastAnalysis: Date.now()
    },
    keywords: [],
    needReconnect: false,
    handleTweets: () => {
    },
    tenant: tenant,
    connection: undefined
  };
  connectToTwitter(stream);
  startPeriodicReconnect(stream);
  return stream;
};

const stopStream = (stream) => {
  stream.connection.abort();
};

const checkTenantCredentials = (tenant) => new Promise((resolve) => {
  const connection = createTwitterStream(tenant, ['placeholder-keyword-to-establish-connection']);
  connection.on('response', (res) => {
    connection.abort();
    if (res.statusCode === 200) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
  connection.on('error', (err) => {
    console.error(`could not connect to twitter: ${err}`);
    connection.abort();
    resolve(false);
  });
});

module.exports = {
  startStream,
  stopStream,
  setKeywords,
  onTweets,
  checkTenantCredentials
};