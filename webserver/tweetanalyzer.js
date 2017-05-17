require('dotenv').config();
const amqp = require('amqplib/callback_api');
const sentiment = require('sentiment');
const stats = require('stats-lite');

/* analyze a single tweet
 return value:
   {
        text: 'Cats are totally amazing',
        score: 4,
        comparative: 1
   }
*/
const analyzeTweet = function (tweet) {
  const analysis = sentiment(tweet);
  return {
    text: tweet,
    score: analysis.score,
    comparative: analysis.comparative,
  };
};

/* analyze a bunch of tweets
   return value:
   {
      tweets: [...] -> list of analyzed tweets (see analyzeTweet)
      score: {
        mean: 0.4,
        median: 0,
        variance: 0.9600000000000002,
        standardDeviation: 0.9797958971132713,
        percentile: 0
      },
      comparative: {
        mean: 0.4,
        median: 0,
        variance: 0.9600000000000002,
        standardDeviation: 0.9797958971132713,
        percentile: 0
      }
   }
*/
const analyzeTweets = function (tweets) {
  const analyzedTweets = tweets.map(t => analyzeTweet(t));
  const scores = analyzedTweets.map(t => t.score);
  const comparatives = analyzedTweets.map(t => t.comparative);
  return {
    tweets: analyzedTweets,
    score: {
      mean: stats.mean(scores),
      median: stats.median(scores),
      variance: stats.variance(scores),
      standardDeviation: stats.stdev(scores),
      percentile: stats.percentile(scores, 0.85),
    },
    comparative: {
      mean: stats.mean(comparatives),
      median: stats.median(comparatives),
      variance: stats.variance(comparatives),
      standardDeviation: stats.stdev(comparatives),
      percentile: stats.percentile(comparatives, 0.85),
    },
  };
};

// key = keyword, value = number of registrations for a given keyword
const keywords = {};

const handleRegisterMessage = function (msg) {
  const keyword = msg.keyword;
  if (keywords[keyword] === null) {
    keywords[keyword] = 0;
  }
  // keep track of registrations
  keywords[keyword] += 1;
};

const handleUnregisterMessage = function (msg) {
  const keyword = msg.keyword;
  if (keywords[keyword] !== null) {
    // decrement registration counter
    keywords[keyword] -= 1;
    if (keywords[keyword] === 0) {
      // there are no more registrations for the given keyword
      delete keywords[keyword];
    }
  }
};

// channel to publish analyzed tweets
let exchangeChannel = null;

// key = keyword, value = list of tweets for the given keyword
const tweets = {};
// number of tweets to collect (per keyword) before analysis starts
const threshold = 10;

const handleNewTweet = function (tweet) {
  /* determine the keyword for the tweet

     note: we have to sort the keywords by length (longest first),
           otherwise more generic words would match first!
           imagine the tweet: "we have a new doghouse :-)"
           as well as the keywords = ['dog', 'doghouse'].
           this sould match 'doghouse' instead of 'dog'.
           this can be reached when we sort the string by length.
  */
  const keyword = Object.keys(keywords)
                        .sort((a, b) => b.length - a.length)
                        .find(kw => tweet.toLowerCase().includes(kw));
  // no keyword found
  if (!keyword) {
    console.log(`no keyword found for: ${tweet}`);
    return;
  }
  // create key for keyword if not already exists
  if (tweets[keyword] == null) {
    tweets[keyword] = [];
  }
  // store tweet
  tweets[keyword].push(tweet);

  // check if exchangeChannel is set up and threshold is reached
  if (exchangeChannel !== null && tweets[keyword].length >= threshold) {
    // analyze a bunch of tweets
    const analysis = analyzeTweets(tweets[keyword]);
    analysis.keyword = keyword;
    // and publish our analysis results
    exchangeChannel.publish('analyzed_tweets', '', Buffer.from(JSON.stringify(analysis)));
    // clear tweets for the keyword
    tweets[keyword] = [];
  }
};

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
  // assert channel for analyzed tweets
  conn.createChannel((createChannelErr, ch) => {
    exchangeChannel = ch;
    exchangeChannel.assertExchange('analyzed_tweets', 'fanout', { durable: false });
  });

  // assert channel for tweet stream
  conn.createChannel((createChannelErr, ch) => {
    ch.assertQueue('tweets', { durable: false });
    ch.consume('tweets', (msg) => {
      const tweet = msg.content.toString();
      handleNewTweet(tweet);
    }, { noAck: true });
  });

  // assert exchange for keyword observation
  conn.createChannel((err, ch) => {
    ch.assertExchange('keywords', 'fanout', { durable: false });
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

