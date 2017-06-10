require('dotenv').config();
const Hapi = require('hapi');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');
const redisCommands = require('../redis/redis-commands');
const redisEvents = require('../redis/redis-events');

const user = "system";

const server = new Hapi.Server();
server.connection({
    host: 'localhost',
    port: 3010
});

/**
 * Route to create a new record. Example payload:
 * {
     tenant: {...},
     keywords: ['fbc', 'bvb'],
     begin: 1497089444598,
     end: 1497089467765
   }
 */
server.route({
    method: 'POST',
    path: '/record',
    handler: function (request, reply) {
        const payload = request.payload;

        console.log(request.payload);
        return reply(request.payload);
    }
});

/*
 persist tweets
 // create dynamo table for this tenant
 dynamoTweets.createTable(tenantId);

 redisCommands.trackKeywords(payload.tenant, user, payload.keywords);
 redisEvents.subscribe(tenantId, user, (tenantId, userId, tweets) => {
 dynamoTweets.insertAnalyzedTweets(tenantId, tweets);
 });
 */

/*
 server.route({
 method: 'GET',
 path: '/tweets/{tenantId}/{keyword}',
 handler: function (request, reply) {
 return reply(dynamoTweets.queryTweets(request.params.tenantId, request.params.keyword,
 request.query.begin, request.query.end));
 }
 });
 */


server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);

    // creating records table if not exist
    dynamoRecords.createTable();
});
