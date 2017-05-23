
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

const handleAnalyzedTweets = (socket, analyzedTweets) => {
  console.log(`received new analyzed tweets for socket ${socket.id} ${analyzedTweets}`);
  socket.emit('analyzedTweets', analyzedTweets);
};

// new client connected
io.on('connection', (socket) => {

  sockets[socket] = {
    tenant: defaultTenant
  };

  redisEvents.subscribe(redisCommands.getId(defaultTenant), socket.id, (analyzedTweets) => {
    handleAnalyzedTweets(socket, analyzedTweets);
  });

  socket.on('tenant', (tenant) => {    
    if (!Joi.validate(tenant, tenantSchema).error) {
      const tenantId = redisCommands.getId(tenant);
      redisCommands.getUserKeywords(tenantId, socket.id).then(keywords => {
        redisCommands.removeUser(sockets[socket].tenant, socket.id);
        sockets[socket].tenant = tenant;
        redisEvents.subscribe(tenantId, socket.id, (analyzedTweets) => {
          handleAnalyzedTweets(socket, analyzedTweets);
        });
        keywords.forEach(keyword => redisCommands.trackKeyword(tenant, socket.id, keyword));
      });
    }    
  });

  socket.on('track', (keyword) => {
    const tenantId = redisCommands.getId(sockets[socket].tenant);
    redisCommands.trackKeyword(tenantId, socket.id, keyword);
  });

  socket.on('untrack', (keyword) => {
    const tenantId = redisCommands(sockets[socket].tenant);
    redisCommands.untrackKeyword(tenantId, socket.id, keyword);
  });

  socket.on('disconnect', () => {
    const userId = socket.id;
    const tenantId = redisCommands.getId(sockets[socket].tenant);
    redisEvents.unsubscribe(tenantId, userId);
    redisCommands.removeUser(tenantId, userId)
                 .then(ok => delete sockets[socket]);
  });

});

setInterval(() => {
  new Set(
    Object.values(sockets)
    .map(value => value.tenant)
    .map(tenant => redisCommands.getId(tenant))
  ).forEach(tenantId => redisCommands.refreshTenantExpiration(tenantId));
}, process.env.KEEP_ALIVE_INTERVAL);

// lets go
http.listen(3000, () => {
  console.log('listening on *:3000');
});
