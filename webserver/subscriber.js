const redis = require('redis');
const bluebird = require('bluebird');
const pubsubutil = require('./pubsubutil');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();
const subscriber = redis.createClient();

// todo: read from env
const db = 0;
const expiration = 3;
const keepAliveInterval = ((expiration - 1) * 1000) / 2;

// enable keyspace events
subscriber.config('set', 'notify-keyspace-events', 'KEA');

// callback when battle for tenant is won
let newTenantCallback = (tenant) => {};
let userAddedCallback = (tenant, userId) => {};
let userRemovedCallback = (tenant, userId) => {};
let keywordAddedCallback = (tenant, userId, keyword) => {};
let keywordRemovedCallback = (tenant, userId, keyword) => {};

// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(`${event}*`);

const has = tenantId => pubsubutil.getTenantIds().includes(tenantId);

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
            pubsubutil.addTenant(tenant);
            newTenantCallback && newTenantCallback(tenant);
            redisGetUserIds(tenantId).then((userIds) => {
              userIds.map((userId) => {
                redisGetUserKeywords(tenantId, userId).then((keywords) => {
                            keywords.forEach(keyword => {
                                pubsubutil.addKeyword(tenant, userId, keyword);
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
            const t = pubsubutil.getTenant(tenantId);
            keywords.forEach((keyword) => {
              pubsubutil.addKeyword(t, userId, keyword);
            });
          });
};

const handlePushUser = (tenantId) => {
  client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
        .then((userIds) => {
          const tenant = pubsubutil.getTenant(tenantId);
          const knownUserIds = pubsubutil.getUserIds(tenantId);
          userIds.forEach((userId) => {
            if (!knownUserIds.includes(userId)) {
              pubsubutil.addUser(tenantId, userId);
              userAddedCallback && userAddedCallback(tenant, userId);
            }
          });
        });
};

const handleRemoveUser = (tenantId) => {
  client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
        .then((userIds) => {
          const tenant = pubsubutil.getTenant(tenantId);
          const knownUserIds = pubsubutil.getUserIds(tenantId);
          knownUserIds.forEach((userId) => {
            if (!userIds.includes(userId)) {
              pubsubutil.removeUser(tenantId, userId);
              userRemovedCallback && userRemovedCallback(tenant, userId);
            }
          });
        });
};

const handleRemoveKeywords = (tenantId, userId) => {
  client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
        .then((keywords) => {
          const tenant = pubsubutil.getTenant(tenantId);
          const userKeywords = pubsubutil.getKeywordsByUser(userId);
          userKeywords.forEach((kw) => {
            if (!keywords.includes(kw)) {
              pubsubutil.removeKeyword(tenantId, userId, kw);
              keywordRemovedCallback && keywordRemovedCallback(tenant, userId, kw);
            }
          });
        });
};

const expired = (redisKey) => {
  console.log(`redis key expired: ${redisKey}`);
  if (/battle:tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:battle:tenants->)/);
    const tenantId = splitted[1];
    battleForTenant(tenantId);
  } else if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    has(tenantId) && pubsubutil.removeTenant(tenantId);
  }
};

const set = (redisKey) => {
  console.log(`redis key was set: ${redisKey}`);
  if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenandId = splitted[1];
    battleForTenant(tenandId).catch(console.error);
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

const battleForFreeTenants = () => Promise.all(redisGetTenantIds().then(ids => ids.map(id => battleForTenant(id))));

// install job for updating battles
let interval;
const start = () => {
  interval = setInterval(() => {
    pubsubutil.getTenantIds().forEach((tenantId) => {
      console.log(`refresh: ${tenantId}`);
      client.expireAsync(`battle:tenants->${tenantId}`, expiration);
    });
  }, keepAliveInterval);
};
const stop = () => {
  clearInterval(interval);
};

start();
battleForFreeTenants();

const tenant = {
  pubsubutil,
  start,
  stop,
  battleForFreeTenants,
  onNewTenant: (callback) => {
    newTenantCallback = callback;
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
};
module.exports = tenant;
