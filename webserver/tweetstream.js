require('dotenv').config();
const request = require('request');
const _ = require('lodash');

const twitterUrl = process.env.TWITTER_URL;

const handleNewTweet = function (stream, tweet) {

  /* determine the keyword for the tweet

     note: we have to sort the keywords by length (longest first),
           otherwise more generic words would match first!
           imagine the tweet: "we have a new doghouse :-)"
           as well as the keywords = ['dog', 'doghouse'].
           this sould match 'doghouse' instead of 'dog'.
           this can be reached when we sort the string by length.
  */

  const keyword = stream.keywords
                        .sort((a, b) => b.length - a.length)
                        .find(kw => tweet.toLowerCase().includes(kw));
  // no keyword found
  if (!keyword) {
    return;
  }
  const tweets = stream.tweets;
  // create key for keyword if not already exists
  if (!tweets[keyword]) {
    tweets[keyword] = [];
  }
  // store tweet
  tweets[keyword].push(tweet);

  // number of tweets to collect (per keyword) before analysis starts
  const threshold = 10;
  // check if exchangeChannel is set up and threshold is reached  
  if (tweets[keyword].length >= threshold) {
    // analyze a bunch of tweets
    stream.handleTweets(keyword, tweets[keyword]);
    // clear tweets for the keyword
    tweets[keyword] = [];
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
      stream.connection.abort();
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
  stream.needReconnect = !_.isEqual(stream.keywords.sort(), keywords.sort());
  stream.keywords = keywords;
};

const startStream = (tenant) => {
  const stream = {
    tweets: {},    
    keywords: [],
    needReconnect: false,
    handleTweets: () => { },
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

module.exports = {
  startStream,
  stopStream,
  setKeywords,
  onTweets
};