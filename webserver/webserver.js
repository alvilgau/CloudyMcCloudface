
require('dotenv').config();
const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const Joi = require('joi');
const redisCommands = require('./redis_commands');
const redisEvents = require('./redis_events');

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

const tenantSchema = Joi.object().keys({
    consumerKey: Joi.string().alphanum().min(3).max(30).required(),
    token: Joi.string().alphanum().min(3).max(30).required(),
    consumerSecret: Joi.string().alphanum().min(3).max(30).required(),
    tokenSecret: Joi.string().alphanum().min(3).max(30).required(),
});

const onAnalyzedTweetsArrived = (socket, analyzedTweets) => {
  console.log(`received new analyzed tweets for socket ${socket.id} ${analyzedTweets}`);
  socket.emit('analyzedTweets', analyzedTweets);
};

// new client connected
io.on('connection', (socket) => {

  sockets[socket] = {
    tenant: defaultTenant
  };
    
  const tId = redisCommands.tenants.getId(defaultTenant);
  redisEvents.subscribe(tId, socket.id, (analyzedTweets) => {
    onAnalyzedTweetsArrived(socket, analyzedTweets);
  });

  socket.on('tenant', (tenant) => {    
    if (!Joi.validate(tenant, tenantSchema).error) {
      const tenantId = redisCommands.tenants.getId(tenant);
      const keywords = redisCommands.tenants.getKeywordsByUser(tenantId, socket.id);
      redisCommands.removeUser(sockets[socket].tenant, socket.id);
      sockets[socket].tenant = tenant;          
      redisEvents.subscribe(tenantId, socket.id, (analyzedTweets) => {
        onAnalyzedTweetsArrived(socket, analyzedTweets);
      });
      keywords.forEach(keyword => redisCommands.trackKeyword(tenant, socket.id, keyword));          
    }    
  });

  socket.on('track', (keyword) => {       
    redisCommands.trackKeyword(sockets[socket].tenant, socket.id, keyword);
  });

  socket.on('untrack', (keyword) => {    
    redisCommands.untrackKeyword(sockets[socket].tenant, socket.id, keyword);    
  });

  socket.on('disconnect', () => {   
    const tenantId = redisCommands.tenants.getId(sockets[socket].tenant); 
    redisEvents.unsubscribe(tenantId, socket.id);
    redisCommands.removeUser(tenantId, socket.id);    
  });

});

setInterval(() => {
  redisCommands.refreshExpirations();  
}, process.env.KEEP_ALIVE_INTERVAL);

// lets go
http.listen(3000, () => {
  console.log('listening on *:3000');
});
