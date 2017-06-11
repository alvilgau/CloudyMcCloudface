const Hapi = require('hapi');
const Boom = require('boom');
const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');

const server = new Hapi.Server();
// todo: refactor host & port to .env
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
        const currentTime = new Date().getTime();
        if (request.payload.begin < currentTime) {
            return reply(Boom.badData('begin must be in the future.'));
        }
        else if (request.payload.end < request.payload.begin) {
            return reply(Boom.badData('end must be after begin.'));
        }

        dynamoRecords.insertRecord(request.payload).then(record => {
            // redisCommands.scheduleRecording(record.id, record.begin, record.end);

            // TODO: remove dummy begin & end
            const begin = new Date();
            begin.setSeconds(begin.getSeconds() + 3);
            const end = new Date();
            end.setSeconds(end.getSeconds() + 20);
            redisCommands.scheduleRecording(record.id, begin.getTime(), end.getTime());

            return reply(record);
        });

    }
});

/**
 * Route to get all records or all record for a specific tenantId
 * QueryParam: /record?tenantId={tenantId}
 */
server.route({
    method: 'GET',
    path: '/record',
    handler: function (request, reply) {
        return reply(dynamoRecords.scanRecords(request.query.tenantId));
    }
});

/**
 * Route to get the analyzed tweets for one record
 */
server.route({
    method: 'GET',
    path: '/tweets/{recordId}',
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
