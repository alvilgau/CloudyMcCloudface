
require('dotenv').config();
const express = require('express');
const http = require('http');
const uuidV4 = require('uuid/v4');

const WebSocket = require('ws');
const Joi = require('joi');
const redisCommands = require('./redis_commands');
const redisEvents = require('./redis_events');
const _ = require('lodash');

const app = express();
const server = http.Server(app);
const wss = new WebSocket.Server({ server });

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
  tenant: tenantSchema.allow(null),
  keywords: Joi.array().items(Joi.string())
});

const subscribe = (ws, message) => {
  sockets[ws].tenant = message.tenant || sockets[ws].tenant;
  redisCommands.trackKeywords(sockets[ws].tenant, sockets[ws].userId, message.keywords);
  redisEvents.subscribe(redisCommands.getId(sockets[ws].tenant), sockets[ws].userId, (tenantId, userId, analyzedTweets) => {
    ws.send(analyzedTweets);
  });
};

const unsubscribe = (ws) => {
  const userId = sockets[ws].userId;
  const tenantId = redisCommands.getId(sockets[ws].tenant);
  redisEvents.unsubscribe(tenantId, userId);
  redisCommands.removeUser(tenantId, userId)
               .then(ok => ok && delete sockets[ws]);
};

wss.on('connection', (ws) => {

  sockets[ws] = {
    tenant: defaultTenant,
    userId: uuidV4(),
    keywords: []
  };

  ws.on('message', (message) => {
    const validation = Joi.validate(message, subscribeSchema);
    if (validation.error) {
      console.error(validation.error);
      ws.send(JSON.stringify(validation));
    } else {
      subscribe(ws, message);
    }
  });

  ws.on('close', () => {
    unsubscribe(ws);
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
server.listen(3000, () => {
  console.log('listening on *:3000');
});
