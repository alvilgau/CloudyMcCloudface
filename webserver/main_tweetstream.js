require('dotenv').config();
const redisEvents = require('./redis_events');
const redisCommands = require('./redis_commands');
const lambda = require('../lambda/main');
const ts = require('./tweetstream');

const streams = {};

const analyzeTweets = (keyword, tweets) => new Promise(
  (resolve) => {
    lambda({ tweets }, null, (res) => {
      res.keyword = keyword;      
      resolve(res);            
    });
  });

const publishAnalyzedTweets = (tenant, analyzedTweets) => {
  const tenantId = redisCommands.getId(tenant);
  const keyword = analyzedTweets.keyword;
  redisCommands.getUserIdsByKeyword(tenantId, keyword)
    .then(userIds => {
      userIds.forEach(userId => {
        console.log(`analyzed tweets: ${analyzedTweets}`);
        redisCommands.publishAnalyzedTweets(tenantId, userId, analyzedTweets);
      });
    });
};

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
    analyzeTweets(keyword, tweets)
      .then(analyzedTweets => publishAnalyzedTweets(tenant, analyzedTweets));
  });
  handlePossibleKeywordChange(tenantId);
};

const battleForTenant = (tenantId) => {
  redisCommands.battleForTenant(tenantId)
    .then(battle => {
      if (battle.wonBattle && battle.tenant) {
        createStreamForTenant(battle.tenant);
      }
    });
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