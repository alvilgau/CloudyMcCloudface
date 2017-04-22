require('dotenv').config();
var amqp = require('amqplib/callback_api');

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {

  conn.createChannel((err, ch) => {
    var ex = 'analyzed_tweets';
    ch.assertExchange(ex, 'fanout', { durable: false });
    ch.assertQueue('', { exclusive: true }, function (err, q) {
      console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
      ch.bindQueue(q.queue, ex, '');
      ch.consume(q.queue, function (msg) {        
        console.log(JSON.parse(msg.content));
      }, { noAck: true });
    });

  });
});