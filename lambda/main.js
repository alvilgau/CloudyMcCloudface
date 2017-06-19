const sentiment = require('sentiment');
const stats = require('stats-lite');

// the scores of the sentiment module are in range [-20, 20],
// but no normal text can reach this, so we use our own limit!
const maxScore = 8;

const bound = (min, value, max) => {
  return Math.max(min, Math.min(value, max));
};

const convertScoreToPercent = (score) => {
  const boundedScore = bound(-maxScore, score, maxScore);
  return (boundedScore / maxScore) * 100;
};

const analyzeTweet = function (tweet) {
  const analysis = sentiment(tweet);
  const score = convertScoreToPercent(analysis.score);
  return { tweet, score };
};

const analyzeTweets = (tweets) => {
  const analyzedTweets = tweets.map(analyzeTweet);
  const scores = analyzedTweets.map(t => t.score);
  return {
    analyzedTweets,
    timestamp: Date.now(),
    values: [
      { name: 'Mean', value: stats.mean(scores) },
      { name: 'Variance', value: stats.variance(scores) },
      { name: 'Standard Deviation', value: stats.stdev(scores) },
      { name: '0.25 Quantile', value: stats.percentile(scores, 0.25) },
      { name: 'Median', value: stats.median(scores) },
      { name: '0.75 Quantile', value: stats.percentile(scores, 0.75) },
    ]
  };
};


module.exports = {
  analyzeTweets,
  analyzeTweet,
  handler = (event, context, callback) => {
    const tweets = event.tweets;
    const analyzedTweets = analyzeTweets(tweets);
    callback(null, analyzedTweets);
  }
};