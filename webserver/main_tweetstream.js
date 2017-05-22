const subscriber = require('./subscriber');
const lambda = require('../lambda/main');
const ts = require('./tweetstream');
const pubsubutil = require('./pubsubutil');

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
  const tenantId = pubsubutil.getId(tenant);
  const stream = streams[tenantId];
  if(stream){
    const keywords = pubsubutil.getKeywordsByTenant(tenantId);
    stream.setKeywords(keywords);
  }
}

subscriber.onNewTenant((tenant) => {
  const stream = ts.startStream(tenant);
  streams[pubsubutil.getId(tenant)] = stream;
  // stream.onClose(() => { streams[tenant.id] = undefined; });
  ts
    .onTweets(stream, (keyword, tweets) => analyzeTweets(keyword, tweets))
    .then(analyzedTweets => saveToRedis(tenant, analyzedTweets));
});

subscriber.onKeywordAdded(handlePossibleKeywordChange);
subscriber.onKeywordRemoved(handlePossibleKeywordChange);
subscriber.onUserAdded(handlePossibleKeywordChange);
subscriber.onUserRemoved(handlePossibleKeywordChange);



subscriber.start();
subscriber.battleForFreeTenants();
