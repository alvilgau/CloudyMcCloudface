require('dotenv').config();
const amqp = require('amqplib/callback_api');
const sentiment = require('sentiment');
const stats = require('stats-lite');
26
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
        comparative: analysis.comparative
    };
};

/* analyze a bunch of tweets
   return value:
   {
       analyzedTweets: ['Cats are totally amazing', 'i love twitter', ...]
       score: {
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
        analyzedTweets: analyzedTweets,
        score: {
            mean: stats.mean(scores),
            median: stats.median(scores),
            variance: stats.variance(scores),
            standardDeviation: stats.stdev(scores),
            percentile: stats.percentile(scores, 0.85)
        }
    };
};

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
    conn.createChannel((err, exchangeChannel) => {
        exchangeChannel.assertExchange('analyzed_tweets', 'fanout', { durable: false });

        // store a bunch of tweets (which will be analyzed all in one step)
        const tweets = [];
        // bunch size
        const treshold = 10;

        conn.createChannel((err, inChannel) => {
            inChannel.assertQueue('tweets', { durable: false });
            inChannel.consume('tweets', (msg) => {
                // we received a new tweet message
                const tweet = msg.content.toString();
                // add the message to our tweets array
                tweets.push(tweet);
                // check if we have received enough tweets
                if (tweets.length == treshold) {
                    // analyze a bunch of tweets
                    const analysis = analyzeTweets(tweets);
                    // publish tweet statistics to subscribers                                     
                    exchangeChannel.publish('analyzed_tweets', '', Buffer.from(JSON.stringify(analysis)));
                    // clear array
                    tweets.length = 0;
                }

            }, { noAck: true });
        });
    });
});

