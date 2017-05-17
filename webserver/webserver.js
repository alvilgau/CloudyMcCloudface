
require('dotenv').config();
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const publisher = require('./publisher');

// serve index.html
app.get('/', (req, res) => {
  res.sendFile(`${__dirname}/index.html`);
});

const sockets = {};

const defaultTenant = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  token: process.env.TWITTER_TOKEN,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  tokenSecret: process.env.TWITTER_TOKEN_SECRET        
};

// new client connected
io.on('connection', (socket) => {
  
  sockets[socket] = {};

  socket.on('tenant', (tenant) => {    
    if (!sockets[socket].tenant) {
      sockets[socket].tenant = tenant;
    }
  });

  // client subscribes a keyword
  socket.on('track', (keyword) => {
    let t = sockets[socket].tenant;
    if (!t) {
      t = defaultTenant;
      sockets[socket].tenant = defaultTenant;
    }    
    publisher.trackKeyword(t, socket.id, keyword);
  });

  // client unsubscribes a keyword
  socket.on('untrack', (keyword) => {
    const t = sockets[socket].tenant;
    if (t) {
      publisher.untrackKeyword(t, socket.id, keyword);
    }        
  });

  // client closed connection
  socket.on('disconnect', () => {
    const t = sockets[socket].tenant;
    if (t) {
      publisher.removeUser(t, socket.id);
    }        
  });
});

// lets go
http.listen(3000, () => {
  console.log('listening on *:3000');
});
