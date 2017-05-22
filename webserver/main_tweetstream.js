require('dotenv').config();
const redisEvents = require('./redis_events');
const lambda = require('../lambda/main');
const ts = require('./tweetstream');

const streams = {};

const analyzeTweets = (keyword, tweets) => new Promise(
  (resolve) => {
    lambda({ tweets }, null, (res) => {
      res.keyword = keyword;
      JSON.stringify(res);
      resolve(res);
    });
  });

const saveToRedis = (tenant, analyzedTweets) => {
  // TODO
};

const handlePossibleKeywordChange = (tenant) => {
  const tenantId = redisEvents.tenants.getId(tenant);
  const stream = streams[tenantId];
  if(stream){
    const keywords = redisEvents.tenants.getKeywordsByTenant(tenantId);
    stream.setKeywords(keywords);
  }
}

redisEvents.onNewTenant((tenant) => {
  const stream = ts.startStream(tenant);
  streams[redisEvents.tenants.getId(tenant)] = stream;
  // stream.onClose(() => { streams[tenant.id] = undefined; });
  ts
    .onTweets(stream, (keyword, tweets) => analyzeTweets(keyword, tweets))
    .then(analyzedTweets => saveToRedis(tenant, analyzedTweets));
});

redisEvents.onKeywordAdded(handlePossibleKeywordChange);
redisEvents.onKeywordRemoved(handlePossibleKeywordChange);
redisEvents.onUserAdded(handlePossibleKeywordChange);
redisEvents.onUserRemoved(handlePossibleKeywordChange);


redisEvents.battleForFreeTenants();

setInterval(() => {
  redisEvents.refreshBattles();   
}, process.env.KEEP_ALIVE_INTERVAL);