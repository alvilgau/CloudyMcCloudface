require('dotenv').config();
const Hapi = require('hapi');
const dynamo = require('./dynamo-api');
const redisCommands = require('../redis/redis-commands');
const redisEvents = require('../redis/redis-events');

const server = new Hapi.Server();
server.connection({
    host: 'localhost',
    port: 3010
});

const defaultTenant = {
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    token: process.env.TWITTER_TOKEN,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    tokenSecret: process.env.TWITTER_TOKEN_SECRET,
};

server.route({
    method: 'GET',
    path: '/tweets/{tenantId}/{keyword}',
    handler: function (request, reply) {
        return reply(dynamo.queryTweets(request.params.tenantId, request.params.keyword,
            request.query.begin, request.query.end));
    }
});

server.route({
    method: 'GET',
    path: '/record/{tenantId}/{keyword}',
    handler: function (request, reply) {
        redisCommands.trackKeywords(defaultTenant, 'system', 'trump');
        redisEvents.subscribe(redisCommands.getId(defaultTenant), 'system', (tenantId, userId, analyzedTweets) => {
            console.log(analyzedTweets);
        });
        return reply("ok");
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});
