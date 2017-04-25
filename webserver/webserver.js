
require('dotenv').config();
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const amqp = require('amqplib/callback_api');

// serve index.html
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

// channel for keyword registration / unregistration
let keywordExchange;

// key = keyword, value = list of subscribed sockets for the keyword
const subscriptions = {};

// notify tweetstream & tweetanalyzer about new keyword
const registerKeyword = function (keyword) {
  if (keywordExchange !== null) {
    const msg = {
      type: 'register',
      keyword,
    };
    keywordExchange.publish('keywords', '', Buffer.from(JSON.stringify(msg)));
  }
};

// notify tweetstream & tweetanalyzer that keyword is no longer used
const unregisterKeyword = function (keyword) {
  if (keywordExchange !== null) {
    const msg = {
      type: 'unregister',
      keyword,
    };
    keywordExchange.publish('keywords', '', Buffer.from(JSON.stringify(msg)));
  }
};

// subscribe socket for the given keyword
const subscribe = function (socket, keyword) {
  // create a new list if keyword isn't tracked yet
  if (!subscriptions[keyword]) {
    subscriptions[keyword] = [];
  }
  // check is socket already subscribed for the keyword
  if (!subscriptions[keyword].includes(socket)) {
    // add socket to keyword list
    subscriptions[keyword].push(socket);
    // tell tweetstream to track the keyword
    registerKeyword(keyword);
  }
};

// remove socket subscription for the given keyword
const unsubscribe = function (socket, keyword) {
  // check if socket is subscribed for this keyword
  if (subscriptions[keyword] && subscriptions[keyword].includes(socket)) {
    // remove socket from list
    subscriptions[keyword] = subscriptions[keyword].filter(s => s !== socket);
    unregisterKeyword(keyword);
  }
};

// removes all keyword subscriptions for a given socket
const removeAllSubscriptions = function (socket) {
  Object.keys(subscriptions).forEach((keyword) => {
    unsubscribe(socket, keyword);
  });
};

// new client connected
io.on('connection', (socket) => {
  console.log('connection', socket.id);

  // client subscribes a keyword
  socket.on('subscribe', (keyword) => {
    subscribe(socket, keyword.toLowerCase());
  });

  // client unsubscribes a keyword
  socket.on('unsubscribe', (keyword) => {
    unsubscribe(socket, keyword.toLowerCase());
  });

  // client closed connection
  socket.on('disconnect', () => {
    removeAllSubscriptions(socket);
  });
});

// notify each client subscribed to the given keyword
const notifyClients = function (data) {
  const keyword = data.keyword;
  const sockets = subscriptions[keyword];
  if (sockets) {
    sockets.forEach(socket => socket.emit('tweets', data));
  }
};

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {
  // create exchange for keywords
  conn.createChannel((createChannelErr, ch) => {
    keywordExchange = ch;
    keywordExchange.assertExchange('keywords', 'fanout', { durable: true });
  });

  // create exchange for analyzed tweets
  conn.createChannel((createChannelErr, ch) => {
    const ex = 'analyzed_tweets';
    ch.assertExchange(ex, 'fanout', { durable: false });
    ch.assertQueue('', { exclusive: true }, (assertQueueErr, q) => {
      ch.bindQueue(q.queue, ex, '');

      ch.consume(q.queue, (msg) => {
        // we received a bunch of analyzed tweets
        const data = JSON.parse(msg.content);
        // time to make the clients happy ...
        notifyClients(data);
      }, { noAck: true });
    });
  });
});

// when app crashes or gets killed, make sure that we unregister all keywords
const cleanUpAndExit = function (reason) {
  console.log(`cleanup and exit: ${reason}`);
  Object.keys(subscriptions).forEach((keyword) => {
    delete subscriptions[keyword];
    unregisterKeyword(keyword);
  });
  process.exit(0);
};
process.on('exit', () => cleanUpAndExit('exit'));
process.on('SIGINT', () => cleanUpAndExit('sigint'));
process.on('SIGTERM', () => cleanUpAndExit('sigterm'));
process.on('SIGHUP', () => cleanUpAndExit('sighup'));
process.on('uncaughtException', () => cleanUpAndExit('uncaught exception'));

// lets go
http.listen(3000, () => {
  console.log('listening on *:3000');
});
