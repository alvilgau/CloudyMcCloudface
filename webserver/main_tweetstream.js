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
    .then(userIds => userIds.forEach(userId => {
        redisCommands.publishAnalyzedTweets(tenantId, userId, analyzedTweets);
    }));
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
    console.log(`trying to send tweets to webserver.js`);
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

redisEvents.onNewTenant(tenantId => battleForTenant(tenantId));
redisEvents.onBattleExpired(tenantId => battleForTenant(tenantId));

redisEvents.onTenantRemoved(tenantId => {  
  const stream = streams[tenantId];
  if (stream) {
    delete streams[tenantId];
    ts.stopStream(stream);    
  }
});

redisEvents.onKeywordAdded((tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.onKeywordRemoved((tenantId, userId) => handlePossibleKeywordChange(tenantId));
redisEvents.onUserAdded((tenantId) => handlePossibleKeywordChange(tenantId));
redisEvents.onUserRemoved((tenantId) => handlePossibleKeywordChange(tenantId));

redisCommands.battleForFreeTenants()
  .then(battles => battles.filter(battle => battle.wonBattle && battle.tenant))
  .then(battles => battles.map(battle => battle.tenant))
  .then(tenants => tenants.forEach(tenant => createStreamForTenant(tenant)));

setInterval(() => {  
  Object.values(streams)    
    .map(value => redisCommands.getId(value.tenant))
    .forEach(tenantId => redisCommands.refreshTenantBattle(tenantId));    
}, process.env.KEEP_ALIVE_INTERVAL);