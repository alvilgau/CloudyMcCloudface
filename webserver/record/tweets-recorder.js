const redisEvents = require('./../redis/redis-events');
const dynamo = require('./dynamo-api');

redisEvents.on('keywordAdded', (tenantId, userId) => {
    dynamo.createTable(tenantId);
    redisEvents.subscribe(tenantId, userId, (tenantId, userId, tweets) => {
        dynamo.insertAnalyzedTweets(tenantId, tweets);
    });
});

/*
 redisEvents.on('keywordRemoved', (tenantId, userId) => {
 console.log('dynamo: keyword removed');
 });

 redisEvents.on('userRemoved', (tenantId, userId) => {
 console.log('dynamo: remove user');
 });
 */