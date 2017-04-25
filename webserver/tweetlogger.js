require('dotenv').config();
const amqp = require('amqplib/callback_api');

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
  conn.createChannel((createChannelErr, ch) => {
    const ex = 'analyzed_tweets';
    ch.assertExchange(ex, 'fanout', { durable: false });
    ch.assertQueue('', { exclusive: true }, (assertQueueErr, q) => {
      console.log(' [*] Waiting for messages in %s. To exit press CTRL+C', q.queue);
      ch.bindQueue(q.queue, ex, '');
      ch.consume(q.queue, (msg) => {
        console.log(JSON.parse(msg.content));
      }, { noAck: true });
    });
  });
});
