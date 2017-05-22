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
  const tenantId = redisEvents.tenants.getId(tenant);
  const keyword = analyzedTweets.keyword;
  const userIds = redisEvents.tenants.getUsersByKeyword(tenantId, keyword);
  userIds.forEach(userId => {
    redisCommands.publishAnalyzedTweets(tenantId, userId, analyzedTweets);
  });    
};

const handlePossibleKeywordChange = (tenant) => {  
  const tenantId = redisEvents.tenants.getId(tenant);
  const stream = streams[tenantId];
  if (stream) {
    const keywords = redisEvents.tenants.getKeywordsByTenant(tenantId);
    ts.setKeywords(stream, keywords);
  }
};

redisEvents.onNewTenant((tenant) => {
  const stream = ts.startStream(tenant);
  streams[redisEvents.tenants.getId(tenant)] = stream;  
  ts.onTweets(stream, (keyword, tweets) => {
      analyzeTweets(keyword, tweets).then(analyzedTweets => {
        publishAnalyzedTweets(tenant, analyzedTweets);
      });
  });  
});

redisEvents.onTenantRemoved((tenant) => {
  const id = redisEvents.tenants.getId(tenant);
  const stream = streams[id];
  if (stream) {
    delete streams[id];
    ts.stopStream(stream);    
  }
});

redisEvents.onKeywordAdded((tenant, userId, keyword) => {
  handlePossibleKeywordChange(tenant);
});

redisEvents.onKeywordRemoved((tenant, userId, keyword) => {
  handlePossibleKeywordChange(tenant);
});

redisEvents.onUserAdded((tenant, userId) => {
  handlePossibleKeywordChange(tenant);
});

redisEvents.onUserRemoved((tenant, userId) => {
  handlePossibleKeywordChange(tenant);
});

redisEvents.battleForFreeTenants();

setInterval(() => {
  redisEvents.refreshBattles();   
}, process.env.KEEP_ALIVE_INTERVAL);