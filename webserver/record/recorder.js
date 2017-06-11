const redisEvents = require('../redis/redis-events');
// const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');

redisEvents.on('startRecord', (recordId) => {
    dynamoRecords.getRecord(recordId).then(record => {
      console.log(record);
   });
});


console.log('recorder is running.');

/*
 persist tweets
 // create dynamo table for this tenant
 dynamoTweets.createTable(tenantId);

 redisCommands.trackKeywords(payload.tenant, user, payload.keywords);
 redisEvents.subscribe(tenantId, user, (tenantId, userId, tweets) => {
 dynamoTweets.insertAnalyzedTweets(tenantId, tweets);
 });
 */