require('dotenv').config();
const redisEvents = require('../redis/redis-events');
const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');

const records = {};

redisEvents.on('startRecord', (recordId) => {
    dynamoRecords.getRecord(recordId)
        .then(record => {
            records[record.id] = record;
            const tenantId = redisCommands.getId(record.tenant);

            // create table for tenant if not exists
            dynamoTweets.createTable(tenantId);

            redisCommands.trackKeywords(record.tenant, record.id, record.keywords);
            redisEvents.subscribe(tenantId, record.id, (tenantId, recordId, tweets) => {
                console.log('analyzed', tweets);
            });
        });
});

redisEvents.on('stopRecord', (recordId) => {
    const record = records[recordId];
    const tenantId = redisCommands.getId(record.tenant);
    redisEvents.unsubscribe(tenantId, recordId);
    redisCommands.removeUser(tenantId, recordId)
        .then(ok => delete records[recordId]);
});

setInterval(() => {
    new Set(
        Object.values(records)
            .map(record => redisCommands.getId(record.tenant))
    ).forEach(tenantId => redisCommands.refreshTenantExpiration(tenantId)
    );
}, process.env.KEEP_ALIVE_INTERVAL);