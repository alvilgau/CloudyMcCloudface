require('dotenv').config();
const redisEvents = require('../redis/redis-events');
const redisCommands = require('../redis/redis-commands');
const dynamoRecords = require('./dynamo-records-api');
const dynamoTweets = require('./dynamo-tweets-api');

const PERSIST_INTERVAL = 5000;
const THREE_SECONDS = 3000;
const records = {};

const battleForRecord = (recordId) => {
    redisCommands.battleForRecord(recordId)
        .then(battle => {
            if (battle.wonBattle && battle.recId) {
                startRecording(battle.recId);
            }
        });
};

const startRecording = (recordId) => {
    dynamoRecords.getRecord(recordId)
        .then(record => {
            // create array to cache tweets
            record.tweets = [];
            records[record.id] = record;
            const tenantId = redisCommands.getId(record.tenant);

            // create table for tenant if not exists
            dynamoTweets.createTable(tenantId);

            redisCommands.trackKeywords(record.tenant, record.id, record.keywords);
            redisEvents.subscribe(tenantId, record.id, (tenantId, recordId, tweets) => {
                // cache tweets to persist them later
                record.tweets.push(tweets);
            });
        });
};

const stopRecording = (recordId) => {
    const record = records[recordId];
    if (!record) {
        return;
    }
    const tenantId = redisCommands.getId(record.tenant);
    redisEvents.unsubscribe(tenantId, recordId);
    redisCommands.removeUser(tenantId, recordId)
        .then(ok => delete records[recordId]);
};

const lookForRecording = () => {
    dynamoRecords.getRecordsInFuture()
        .then(records => {
            const currentTime = new Date().getTime() + THREE_SECONDS;
            records.forEach(record => {
                const begin = Math.max(record.begin, currentTime);
                redisCommands.scheduleRecording(record.id, begin, record.end);
            });
        });
};

redisEvents.on('startRecord', battleForRecord);
redisEvents.on('recordBattleExpired', battleForRecord);
redisEvents.on('stopRecord', stopRecording);

// Look for possible recording when service get started
lookForRecording();

// send keep alive
setInterval(() => {
    new Set(
        Object.values(records)
            .map(record => {
                return {tenantId: redisCommands.getId(record.tenant), recordId: record.id};
            })
    ).forEach((ret) => {
        redisCommands.refreshTenantExpiration(ret.tenantId);
        redisCommands.refreshRecordExpiration(ret.recordId);
    });
}, process.env.KEEP_ALIVE_INTERVAL);

// persist analyzed tweets
setInterval(() => {
    Object.values(records)
        .forEach(record => {
            if (record.tweets.length > 0) {
                // new tweets available, persist now
                const tenantId = redisCommands.getId(record.tenant);
                dynamoTweets.insertAnalyzedTweets(tenantId, record.id, record.tweets)
                    .then(() => {
                        // clear cached tweets
                        record.tweets = [];
                    });
            }
        });
}, PERSIST_INTERVAL);