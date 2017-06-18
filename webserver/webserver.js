require('dotenv').config();
const Hapi = require('hapi');
const Path = require('path');
const Boom = require('boom');
const http = require('http');
const uuidV4 = require('uuid/v4');
const WebSocket = require('ws');
const Joi = require('joi');
const redisCommands = require('./redis/redis-commands');
const redisEvents = require('./redis/redis-events');
const _ = require('lodash');
const credentialsValidator = require('./credentials-validator');

// hapi web server

const server = new Hapi.Server({
  connections: {
    routes: {
      files: {
        relativeTo: Path.join(__dirname, 'public')
      }
    }
  }
});

server.connection({
  host: 'localhost',
  port: process.env.WEBSERVER_PORT || 3000
});

server.register([require('inert'), require('./record/record-rest')], () => {});

server.route({
  method: 'GET',
  path: '/{param*}',
  handler: {
    directory: {
      path: '.',
      redirectToSlash: true,
      index: true
    }
  }
});

server.route({
  method: 'POST',
  path: '/tenants/validate',
  handler: (request, reply) => {
    credentialsValidator.areCredentialsValid(request.payload)
      .then(ok => {
        if (!ok) return reply(Boom.unauthorized('then'));
        else     return reply({});
      })
      .catch(err => reply(Boom.unauthorized('catch')));
  }
});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log('Server running at:', server.info.uri);
});


// web socket

const wss = new WebSocket.Server({port: 3001});

const sockets = {};

const defaultTenant = {
  consumerKey: process.env.TWITTER_CONSUMER_KEY,
  token: process.env.TWITTER_TOKEN,
  consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
  tokenSecret: process.env.TWITTER_TOKEN_SECRET,
};

const subscribeSchema = Joi.object().keys({
  tenant: credentialsValidator.tenantSchema.allow(null),
  keywords: Joi.array().items(Joi.string()).required()
});

const subscribe = (connection, message) => {
  connection.tenant = message.tenant || connection.tenant;
  redisCommands.trackKeywords(connection.tenant, connection.userId, message.keywords);
  redisEvents.subscribe(redisCommands.getId(connection.tenant), connection.userId, (tenantId, userId, analyzedTweets) => {
    connection.ws.send(JSON.stringify(analyzedTweets));
  });
};

const unsubscribe = (connection) => {
  const userId = connection.userId;
  const tenantId = redisCommands.getId(connection.tenant);
  if (userId && tenantId) {
    redisEvents.unsubscribe(tenantId, userId);
    redisCommands.removeUser(tenantId, userId)
      .then(ok => ok && delete sockets[userId]);
  }
};

wss.on('connection', (ws) => {

  const userId = uuidV4();
  sockets[userId] = {
    tenant: defaultTenant,
    userId: userId,
    ws: ws,
    keywords: [],
  };

  ws.on('message', (message) => {
    const validation = Joi.validate(message, subscribeSchema);
    if (validation.error) {
      console.error(validation.error);
      ws.send(JSON.stringify({type: 'error', message: 'Invalid Data Schema!'}));
    } else {
      const t = message.tenant || sockets[userId].tenant;
      credentialsValidator.areCredentialsValid(t)
        .then(ok => {
          if (ok) {
            console.log(`tenant credentials are valid`);
            subscribe(sockets[userId], JSON.parse(message));
          } else {
            console.error(`client tried to connect with invalid twitter credentials`);
            connection.ws.send(JSON.stringify({type: 'error', message: 'Invalid Twitter Credentials!'}));
          }
        });
    }
  });

  ws.on('close', () => {
    unsubscribe(sockets[userId]);
  });

});

setInterval(() => {
  new Set(
    Object.values(sockets)
      .map(value => value.tenant)
      .map(tenant => redisCommands.getId(tenant))
  ).forEach(tenantId => redisCommands.refreshTenantExpiration(tenantId));
}, process.env.KEEP_ALIVE_INTERVAL);
