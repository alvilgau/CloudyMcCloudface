require('dotenv').config();
const amqp = require('amqplib/callback_api');

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
    conn.createChannel((err, exchangeChannel) => {
        exchangeChannel.assertExchange('analyzed_tweets', 'fanout', { durable: false });

        conn.createChannel((err, inChannel) => {
            inChannel.assertQueue('tweets', { durable: false });
            inChannel.consume('tweets', (msg) => {
                exchangeChannel.publish('analyzed_tweets', '', new Buffer(msg.content.toString()));
            }, { noAck: true });
        });
    });
});