
require('dotenv').config();
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const amqp = require('amqplib/callback_api');

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// key = keyword, value = list of subscribed sockets for the keyword
const subscriptions = {};

// notify tweetstream & tweetanalyzer about new keyword
const registerKeyword = function(keyword) {

};

// notify tweetstream & tweetanalyzer that keyword is no longer in use
const unregisterKeyword = function(keyword) {

};

// subscribe socket for the given keyword
const subscribe = function (socket, keyword) {
  // keyword is not tracked
  if (!subscriptions[keyword]) {
    // track keyword
    subscriptions[keyword] = [socket];        
    // this keyword was not tracked before by any other client
    // tell tweestream + tweetanalyzer to track this keyword
    registerKeyword(keyword);
  } else if (subscriptions[keyword].filter((s) => s === socket).length === 0) {
    // keyword is already tracked
    // add socket to keyword list
    subscriptions[keyword].push(socket);
  }
};

// remove socket subscription for the given keyword
const unsubscribe = function (socket, keyword) {
  // check if there is at least one subscription for the given keyword
  if (subscriptions[keyword]) {
    // remove socket from keyword list
    subscriptions[keyword] = subscriptions[keyword].filter((s) => s !== socket);        
    // check if there are any other subscriptions for the given keyword
    if (subscriptions[keyword].length === 0) {
      // there are no other subscriptions for this keyword,
      // -> this keyword is not used anymore by any of the connected clients
      delete subscriptions[keyword];                        
      unregisterKeyword(keyword);                            
    }
  }
};

const removeAllSubscriptions = function (socket) {
  Object.keys(subscriptions).forEach((keyword) => {
    unsubscribe(keyword, socket);
  });
};

io.on('connection', (socket) => {

  console.log('connection', socket.id);

  socket.on('subscribe', (keyword) => {
    console.log('subscribe', keyword);
    subscribe(socket, keyword);
  });

  socket.on('unsubscribe', (keyword) => {
    console.log('unsubscribe', keyword);
    unsubscribe(socket, keyword);
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    removeAllSubscriptions(socket);
  });

});

// notify each client subscribed to the given keyword
const notifyClients = function(keyword, data) {
  if (subscriptions[keyword] != null) {
    subscriptions[keyword].forEach((socket) => {
      socket.emit('tweet', tweet);
    });
  }
};

amqp.connect(process.env.RABBITMQ_URL, (err, conn) => {

  conn.createChannel((err, ch) => {
    var ex = 'analyzed_tweets';
    ch.assertExchange(ex, 'fanout', { durable: false });
    ch.assertQueue('', { exclusive: true }, function (err, q) {      
      ch.bindQueue(q.queue, ex, '');
      ch.consume(q.queue, function (msg) {        
        
        // we received a new bunch of analyzed tweets
        const data = JSON.parse(msg.content);                
        // time to make the clients happy ...
        notifyClients(data.keyword, data);        
        
      }, { noAck: true });
    });
  });
});

http.listen(3000, function () {
  console.log(process.pid);
  console.log('listening on *:3000');
});

// when app crashes or gets killed, make sure that we unregister all keywords
const cleanUpAndExit = function(reason) {
  console.log("cleanup and exit: " + reason);
  Object.keys(subscriptions).forEach((keyword) => {        
    delete subscriptions[keyword];        
    unregisterKeyword(keyword)
  });    
  process.exit(0);
};
process.on('exit', (code) => cleanUpAndExit('exit'));
process.on('SIGINT', () => cleanUpAndExit('sigint'));
process.on('SIGTERM', () => cleanUpAndExit('sigterm'));
process.on('SIGHUP', () => cleanUpAndExit('sighup'));
process.on('uncaughtException', (err) => cleanUpAndExit('uncaught exception'));