require('dotenv').config();
const redis = require('redis');
const bluebird = require('bluebird');
const tenants = require('./tenants');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();
const subscriber = redis.createClient();

const db = process.env.REDIS_DB || 0;
const expiration = process.env.EXPIRATION || 3;
const keepAliveInterval = process.env.KEEP_ALIVE_INTERVAL || 1000;

// enable keyspace events
subscriber.config('set', 'notify-keyspace-events', 'KEA');

// callback when battle for tenant is won
let newTenantCallback = (tenant) => {};
let tenantRemovedCallback = (tenant) => {};
let userAddedCallback = (tenant, userId) => {};
let userRemovedCallback = (tenant, userId) => {};
let keywordAddedCallback = (tenant, userId, keyword) => {};
let keywordRemovedCallback = (tenant, userId, keyword) => {};

// handler for analyzed keywords
const subscriptions = [];
const getSubscription = (tenantId, userId) => {
  return subscriptions.filter(s => s.tenantId === tenantId && s.userId === userId);
};

// subscribe for all events
let doBattle = false;
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(`${event}*`);

const has = tenantId => tenants.getTenantIds().includes(tenantId);

const redisGetTenant = tenantId => client.getAsync(`tenants->${tenantId}`)
                .then(res => JSON.parse(res));

const redisGetTenantIds = () => client.scanAsync(0, 'MATCH', 'tenants->*')
                .then((res) => {
                  const redisKeys = res[1];
                  const tenantIds = redisKeys.map(key => key.replace('tenants->', ''));
                  return tenantIds;
                })
                .catch((err) => {
                  console.error('could not query tenant ids from redis');
                  console.error(err);
                  return [];
                });

const redisGetUserIds = tenantId => client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
            .then(ids => ids)
            .catch((err) => {
              console.error(`could not query user ids for tenant ${tenantId} from redis`);
              console.error(err);
              return [];
            });

const redisGetUserKeywords = (tenantId, userId) => client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
            .then(keywords => new Set(keywords))
            .catch((err) => {
              console.error(`could not query keywords for tenant ${tenantId} from redis`);
              console.error(err);
              return new Set();
            });

const battleForTenant = (tenantId) => {
  console.log(`start a battle for tenant ${tenantId}`);
  return new Promise((resolve, reject) => {
    client.multi()
        .get(`tenants->${tenantId}`)
        .incr(`battle:tenants->${tenantId}`)
        .expire(`battle:tenants->${tenantId}`, expiration)
        .execAsync()
        .then((res) => {
            // get result from incr command
          const tenant = JSON.parse(res[0]);
          const battleCounter = res[1];
            // only one service will receive counter == 1
          const wonBattle = battleCounter == 1;
          if (tenant && wonBattle) {
            console.log(`won battle for tenant ${tenantId}`);
            console.log(`add tenant ${tenant}`);
            tenants.addTenant(tenant);
            newTenantCallback && newTenantCallback(tenant);
            redisGetUserIds(tenantId).then((userIds) => {
              userIds.map((userId) => {
                redisGetUserKeywords(tenantId, userId).then((keywords) => {
                            keywords.forEach(keyword => {
                                tenants.addKeyword(tenant, userId, keyword);
                                keywordAddedCallback && keywordAddedCallback(tenant, userId, keyword);
                            });                                   
                  userAddedCallback && userAddedCallback(tenant, userId);
                });
              });
            })
            .catch((err) => {
              console.error(err);
              reject(err);
            });
            resolve(wonBattle);
          } else {
            if (!tenant) {
              // we don't need more battles -> there is no such tenant
              client.delAsync(`battle:tenants->${tenantId}`);
            }
            // we also fulfill the promise when we lost
            // because everything else went fine
            resolve(wonBattle);
            console.log(`lost battle for tenant ${tenant}`);
          }
        })
        .catch(err => reject(err));
  });
};

const handlePushKeywords = (tenantId, userId) => {
  client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
          .then((keywords) => {
            const t = tenants.getTenant(tenantId);
            const trackedKeywords = tenants.getKeywordsByUser(tenantId, userId);
            keywords.forEach((keyword) => {              
              if (!trackedKeywords.has(keyword)) {
                tenants.addKeyword(t, userId, keyword);
                keywordAddedCallback && keywordAddedCallback(t, userId, keyword);
              }              
            });
          });
};

const handlePushUser = (tenantId) => {
  client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
        .then((userIds) => {
          const tenant = tenants.getTenant(tenantId);
          const knownUserIds = tenants.getUserIds(tenantId);
          userIds.forEach((userId) => {
            if (!knownUserIds.includes(userId)) {
              tenants.addUser(tenantId, userId);
              userAddedCallback && userAddedCallback(tenant, userId);
            }
          });
        });
};

const handleRemoveUser = (tenantId) => {
  client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
        .then((userIds) => {
          const tenant = tenants.getTenant(tenantId);
          const knownUserIds = tenants.getUserIds(tenantId);
          knownUserIds.forEach((userId) => {
            if (!userIds.includes(userId)) {
              tenants.removeUser(tenantId, userId);
              userRemovedCallback && userRemovedCallback(tenant, userId);
            }
          });
        });
};

const handleRemoveKeywords = (tenantId, userId) => {
  client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
        .then((keywords) => {
          const tenant = tenants.getTenant(tenantId);
          const userKeywords = tenants.getKeywordsByUser(userId);
          userKeywords.forEach((kw) => {
            if (!keywords.includes(kw)) {
              tenants.removeKeyword(tenantId, userId, kw);
              keywordRemovedCallback && keywordRemovedCallback(tenant, userId, kw);
            }
          });
        });
};

const handleRemoveTenant = (tenantId) => {
  const tenant = tenants.getTenant(tenantId);
  tenants.removeTenant(tenant);
  tenantRemovedCallback && tenantRemovedCallback(tenant);
};

const expired = (redisKey) => {
  console.log(`redis key expired: ${redisKey}`);
  if (/battle:tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:battle:tenants->)/);
    const tenantId = splitted[1];
    doBattle && battleForTenant(tenantId);
  } else if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    has(tenantId) && handleRemoveTenant(tenantId);
  }
};

const set = (redisKey) => {
  console.log(`redis key was set: ${redisKey}`);
  if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenandId = splitted[1];
    doBattle && battleForTenant(tenandId).catch(console.error);
  }
};

const lpush = (redisKey) => {
  console.log(`value to redis key was pushed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const user = splitted[2];
    has(tenantId) && handlePushKeywords(tenantId, user);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    has(tenantId) && handlePushUser(tenantId);
  }
};

const lrem = (redisKey) => {
  console.log(`redis key was removed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    has(tenantId) && handleRemoveKeywords(tenantId, userId);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    has(tenantId) && handleRemoveUser(tenantId);
  }
};

const del = (redisKey) => {
  console.log(`redis key was deleted: ${redisKey}`);
  if (/tenant:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenant\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    has(tenantId) && handleRemoveKeywords(tenantId, userId);
  }
};

const pmessageHandlers = {
  expired, set, lpush, lrem, del,
};
subscriber.on('pmessage', (pattern, channel, msg) => {
  const msgType = channel.replace(event, '');
  const handler = pmessageHandlers[msgType];
  if (handler) {
    handler(msg);
  }
});

subscriber.on('message', (channel, message) => {
  if (/tenants:\S+:users:\S+->analyzedTweets->/.test(channel)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->analyzedTweets)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    const subscription = getSubscription(tenantId, userId);
    if (subscription) {
      subscription.callback(tenantId, userId, JSON.parse(message));
    }
  }
});

const battleForFreeTenants = () => {
  doBattle = true;
  Promise.all(redisGetTenantIds().then(ids => ids.map(id => battleForTenant(id))));
};

const refreshBattles = () => {
  tenants.getTenantIds().forEach((tenantId) => {
    console.log(`refresh battle for ${tenantId}`);
    client.expireAsync(`battle:tenants->${tenantId}`, expiration);
  });
};

const doUnsubscribe = (tenantId, userId) => {
  const subscription = getSubscription(tenantId, userId);
  if (subscription) {
    const index = subscriptions.indexOf(subscription);
    subscriptions.splice(index, 1);
  }
};

const doSubscribe = (tenantId, userId, callback) => {
  doUnsubscribe(tenantId, userId);
  subscriptions.push({tenantId, userId, callback});
};

module.exports = {
  tenants,
  battleForFreeTenants,
  refreshBattles,
  onNewTenant: (callback) => {
    newTenantCallback = callback;
  },
  onTenantRemoved: (callback) => {
    tenantRemovedCallback = callback;
  },
  onUserAdded: (callback) => {
    userAddedCallback = callback;
  },
  onUserRemoved: (callback) => {
    userRemovedCallback = callback;
  },
  onKeywordAdded: (callback) => {
    keywordAddedCallback = callback;
  },
  onKeywordRemoved: (callback) => {
    keywordRemovedCallback = callback;
  },
  unsubscribe: (tenantId, userId) => {
    doUnsubscribe(tenantId, userId);    
  },
  subscribe: (tenantId, userId, callback) => {        
    doSubscribe(tenantId, userId, callback);    
  }
};
