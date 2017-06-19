require('dotenv').config();
const redisEvents = require('./../redis/redis-events');
const redisCommands = require('./../redis/redis-commands');
const ts = require('./tweetstream');
const lambda = require('./lambda');

lambda.deleteLambdaFunction()
  .then(ok => lambda.createLambdaFunction())
  .then(console.log)
  .catch(err => {
    console.error(`could not create lambda function: ${err}`);
    process.exit(1);
  });

const streams = {};

const handlePossibleKeywordChange = tenantId => {    
  const stream = streams[tenantId];
  if (stream) {
    redisCommands.getKeywordsByTenant(tenantId)
      .then(keywords => ts.setKeywords(stream, keywords));
  }
};

const createStreamForTenant = tenant => {  
  const tenantId = redisCommands.getId(tenant);
  const stream = ts.startStream(tenant);
  streams[tenantId] = stream;
  ts.onTweets(stream, (keyword, tweets) => {
    lambda.analyzeTweets(tweets)
      .then(analyzedTweets => {
        analyzedTweets.keyword = keyword;
        redisCommands.getUserIdsByKeyword(tenantId, keyword)
          .then(userIds => {
            userIds.forEach(userId => redisCommands.publishAnalyzedTweets(tenantId, userId, analyzedTweets));
          });
      })
      .catch(console.error);
  });
  handlePossibleKeywordChange(tenantId);
};

const battleForTenant = (tenantId) => {

  // we punish those tweet-streams which already own a lot of tenants
  const delay = Object.keys(streams).length * 30 /* ms */;

  setTimeout(() => {
    redisCommands.battleForTenant(tenantId)
      .then(battle => {
        if (battle.wonBattle && battle.tenant) {
          createStreamForTenant(battle.tenant);
        }
      });
  }, delay);
};

redisEvents.on('newTenant', (tenantId) => battleForTenant(tenantId));
redisEvents.on('battleExpired', (tenantId) => battleForTenant(tenantId));
redisEvents.on('keywordAdded', (tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.on('keywordRemoved', (tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.on('userAdded', (tenantId) => handlePossibleKeywordChange(tenantId));
redisEvents.on('userRemoved', (tenantId) => handlePossibleKeywordChange(tenantId));
redisEvents.on('tenantRemoved', (tenantId) => {
  const stream = streams[tenantId];
  if (stream) {
    ts.stopStream(stream);
    delete streams[tenantId];
  }
});

redisCommands.battleForFreeTenants()
  .then(battles => battles.filter(battle => battle.wonBattle && battle.tenant))
  .then(battles => battles.map(battle => battle.tenant))
  .then(tenants => tenants.forEach(tenant => createStreamForTenant(tenant)));

setInterval(() => {  
  Object.values(streams)    
    .map(value => redisCommands.getId(value.tenant))
    .forEach(tenantId => redisCommands.refreshTenantBattle(tenantId));    
}, process.env.KEEP_ALIVE_INTERVAL);