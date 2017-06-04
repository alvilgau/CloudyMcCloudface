
require('dotenv').config();
const app = require('express')();
const http = require('http').Server(app);
const WebSocket = require('ws');
const Joi = require('joi');
const redisCommands = require('./redis_commands');
const redisEvents = require('./redis_events');
const _ = require('lodash');

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
    consumerKey: Joi.string().min(3).max(30).required(),
    token: Joi.string().length(50).required(),
    consumerSecret: Joi.string().length(50).required(),
    tokenSecret: Joi.string().min(30).max(60).required()
});

const subscribeSchema = Joi.object().keys({
  tenant: tenantSchema.required().allow(null),
  keywords: Joi.array().items(Joi.string())
});

const wss = new WebSocket.Server({port: process.env.WEBSOCKET_SERVER_PORT || 3001});

wss.on('connection', (ws) => {

  sockets[ws] = {
    tenant: defaultTenant,
    keywords: []
  };

  ws.on('message', (message) => {
    console.log('message', message);
    const validation = Joi.validate(message, subscribeSchema);
    if (validation.error) {
      //ws.send({ error: validation.error });
    } else {
      sockets[ws].tenant = message.tenant || defaultTenant;
      redisCommands.trackKeywords(sockets[ws].tenant, ws._ultron.id, message.keywords);
    }
  });

  ws.on('close', () => {
    console.log('socket closed connection');
  });

});
/*
// new client connected
io.on('connection', (socket) => {

  sockets[socket] = {
    tenant: defaultTenant
  };

  redisEvents.subscribe(redisCommands.getId(defaultTenant), socket.id, (tenantId, userId, analyzedTweets) => {
    socket.emit('tweets', analyzedTweets);
  });

  socket.on('tenant', (tenant) => {    
    if (!Joi.validate(tenant, tenantSchema).error) {
      const tenantId = redisCommands.getId(tenant);
      redisCommands.getUserKeywords(tenantId, socket.id).then(keywords => {
        redisCommands.removeUser(sockets[socket].tenant, socket.id);
        sockets[socket].tenant = tenant;
        redisEvents.subscribe(tenantId, socket.id, (tenantId, userId, analyzedTweets) => {
          socket.emit('tweets', analyzedTweets);
        });
        keywords.forEach(keyword => redisCommands.trackKeyword(tenant, socket.id, keyword));
      });
    }    
  });

  socket.on('track', (keyword) => {    
    redisCommands.trackKeyword(sockets[socket].tenant, socket.id, keyword);
  });

  socket.on('untrack', (keyword) => {
    const tenantId = redisCommands.getId(sockets[socket].tenant);
    redisCommands.untrackKeyword(tenantId, socket.id, keyword);
  });

  socket.on('disconnect', () => {
    const userId = socket.id;
    const tenantId = redisCommands.getId(sockets[socket].tenant);
    redisEvents.unsubscribe(tenantId, userId);
    redisCommands.removeUser(tenantId, userId)
                 .then(ok => ok && delete sockets[socket]);
  });
});
*/

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
