const Hapi = require('hapi');
const Boom = require('boom');
const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');

const server = new Hapi.Server();
server.connection({
    host: 'localhost',
    port: process.env.RECORD_REST_PORT
});

const THREE_SECONDS = 3000;
const ONE_MINUTE = 60000;

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
    path: '/records',
    handler: function (request, reply) {
        const payload = request.payload;
        const currentTime = new Date().getTime();

        // no time set, then record now for 1 minute
        if (!payload.begin && !payload.end) {
            payload.begin = currentTime + THREE_SECONDS;
            payload.end = payload.begin + ONE_MINUTE;
        }
        // when 1 time param is set, the other time param must be set too
        else if (!(payload.begin && payload.end)) {
            return reply(Boom.badData('When 1 time parameter is set, the other time parameter must be set too'));
        }
        // 'begin' must be in the future
        else if (payload.begin < currentTime) {
            return reply(Boom.badData('begin must be in the future.'));
        }
        // 'end' must be after 'begin'
        else if (payload.end < payload.begin) {
            return reply(Boom.badData('end must be after begin.'));
        }

        dynamoRecords.insertRecord(payload).then(record => {
            redisCommands.scheduleRecording(record.id, record.begin, record.end);
            return reply(record);
        });

    }
});

/**
 * Route to get all records for a specific tenantId
 */
server.route({
    method: 'GET',
    path: '/tenants/{tenantId}/records',
    handler: function (request, reply) {
        return reply(dynamoRecords.scanRecordsByTenant(request.params.tenantId));
    }
});

/**
 * Route to get the analyzed tweets for one record
 */
server.route({
    method: 'GET',
    path: '/records/{recordId}/tweets',
    handler: function (request, reply) {
        dynamoRecords.getRecord(request.params.recordId)
            .then(record => {
                if (!record) {
                    return Boom.notFound('Record not found.');
                }
                const tenantId = redisCommands.getId(record.tenant);
                return dynamoTweets.queryTweets(tenantId, record.id);
            })
            .then(reply);
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);

    // creating records table if not exist
    dynamoRecords.createTable();
});
