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
const analyzeTweets = (tweets) => {
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

module.exports = function(event, context, callback) {
    const tweets = event.tweets; // TODO Extract tweets from lambda event
    const analyzedTweets = analyzeTweets(tweets);
    callback(analyzedTweets, "success");
}
