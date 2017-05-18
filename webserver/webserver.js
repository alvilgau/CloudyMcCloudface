
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
  tokenSecret: process.env.TWITTER_TOKEN_SECRET,
};

// new client connected
io.on('connection', (socket) => {

  sockets[socket] = {
    tenant: defaultTenant
  };

  socket.on('tenant', (tenant) => {    
    const tenantId = publisher.pubsubutil.getId(tenant);
    const keywords = publisher.pubsubutil.getKeywordsByUser(tenantId, socket.id);
    publisher.removeUser(sockets[socket].tenant, socket.id);
    sockets[socket].tenant = tenant;    
    keywords.forEach(keyword => publisher.trackKeyword(tenant, socket.id, keyword));    
  });

  socket.on('track', (keyword) => {       
    publisher.trackKeyword(sockets[socket].tenant, socket.id, keyword);
  });

  socket.on('untrack', (keyword) => {    
    publisher.untrackKeyword(sockets[socket].tenant, socket.id, keyword);    
  });

  socket.on('disconnect', () => {    
    publisher.removeUser(sockets[socket].tenant, socket.id);    
  });

});

// lets go
http.listen(3000, () => {
  console.log('listening on *:3000');
});
