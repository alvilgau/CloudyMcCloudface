require('dotenv').config();
const redis = require('redis');
const bluebird = require('bluebird');
const _ = require('lodash');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const expiration = process.env.EXPIRATION;

const getId = (tenant) => {
  return tenant.consumerKey;
};

const trackKeyword = (tenant, userId, keyword) => {
  return trackKeywords(tenant, userId, [keyword]);
};

const trackKeywords = (tenant, userId, keywords) => {
  const tenantId = getId(tenant);
  console.log(`track keywords for tenant ${tenantId}`);
  return client.multi()
    .setnx(`tenants->${tenantId}`, JSON.stringify(tenant))
    .expire(`tenants->${tenantId}`, expiration)
    .lpush(`tenants:${tenantId}->users`, userId)
    .expire(`tenants:${tenantId}->users`, expiration)
    .del(`tenants:${tenantId}:users:${userId}->keywords`)
    .lpush(`tenants:${tenantId}:users:${userId}->keywords`, keywords)
    .expire(`tenants:${tenantId}:users:${userId}->keywords`, expiration)
    .execAsync()
    .then(ok => true)
    .catch(err => false);
};

const untrackKeyword = (tenantId, userId, keyword) => {
  return client.lremAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, keyword)
    .then(ok => true)
    .catch(err => false);
};

const scheduleRecording = (recordId, begin, end) => {
  const currentTime = new Date().getTime();
  const expirationStart = Math.floor((begin - currentTime) / 1000);
  const expirationEnd = Math.floor((end - currentTime) / 1000);
  return client.multi()
    .set(`record:start:${recordId}`, recordId)
    .expire(`record:start:${recordId}`, expirationStart)
    .set(`record:stop:${recordId}`, recordId)
    .expire(`record:stop:${recordId}`, expirationEnd)
    .execAsync()
    .then(ok => true)
    .catch(err => false);
};

const removeUser = (tenantId, userId) => {
  return client.multi()
    .lrem(`tenants:${tenantId}->users`, 0, userId)
    .del(`tenants:${tenantId}:users:${userId}->keywords`)
    .execAsync()
    .then(ok => true)
    .catch(err => false);
};

const getTenantIds = () => {
  return client.scanAsync(0, 'MATCH', 'tenants->*')
    .then(res => {
      const redisKeys = res[1];
      return redisKeys.map(key => key.replace('tenants->', ''));
    })
    .catch(err => {
      console.error('could not query tenant ids from redis');
      console.error(err);
      return [];
    });
};

const getUserIds = (tenantId) => {
  return client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
    .then(ids => _.uniq(ids))
    .catch(err => {
      console.error(`could not query user ids for tenant ${tenantId} from redis`);
      console.error(err);
      return [];
    });
};

const getUserIdsByKeyword = (tenantId, keyword) => {
  return getUserIds(tenantId)
    .then(userIds =>
      userIds.map(userId =>
        getUserKeywords(tenantId, userId)
          .then(keywords => {
            if (keywords.includes(keyword))
              return userId;
            else return undefined;
          })
      )
    )
    .then(promises => Promise.all(promises))
    .then(userIds => userIds.filter(userId => userId !== undefined));
};

const getUserKeywords = (tenantId, userId) => {
  return client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
    .then(keywords => _.uniq(keywords))
    .catch(err => {
      console.error(`could not query keywords for tenant ${tenantId} from redis`);
      console.error(err);
      return [];
    });
};

const battleForTenant = (tenantId) => {
  console.log(`start a battle for tenant ${tenantId}`);
  return new Promise((resolve, reject) => {
    client.multi()
      .get(`tenants->${tenantId}`)
      .incr(`battle:tenants->${tenantId}`)
      .expire(`battle:tenants->${tenantId}`, expiration)
      .execAsync()
      .then(res => {
        // get result from incr command
        const tenant = JSON.parse(res[0]);
        const battleCounter = res[1];
        // only one service will receive counter == 1
        const wonBattle = battleCounter == 1;
        if (tenant && wonBattle) {
          console.log(`won battle for tenant ${tenantId}`);
          resolve({tenant, wonBattle});
        } else {
          if (!tenant) {
            // we don't need more battles -> there is no such tenant
            client.delAsync(`battle:tenants->${tenantId}`);
          }
          // we also fulfill the promise when we lost
          // because everything else went fine
          resolve({tenant, wonBattle});
          console.log(`lost battle for tenant ${tenantId}`);
        }
      })
      .catch(err => reject(err));
  });
};

const battleForRecord = (recordId) => {
  console.log(`start a battle for record ${recordId}`);
  return new Promise((resolve, reject) => {
    client.multi()
      .get(`record:stop:${recordId}`)
      .incr(`battle:record:${recordId}`)
      .expire(`battle:record:${recordId}`, expiration)
      .execAsync()
      .then(res => {
        // get result from incr command
        const recId = res[0];
        const battleCounter = res[1];
        // only one service will receive counter == 1
        const wonBattle = battleCounter == 1;
        if (recId && wonBattle) {
          console.log(`won battle for record ${recId}`);
          resolve({recId, wonBattle});
        } else {
          if (!recId) {
            // we don't need more battles -> there is no such record
            client.delAsync(`battle:record:${recordId}`);
          }
          // we also fulfill the promise when we lost
          // because everything else went fine
          resolve({recId, wonBattle});
          console.log(`lost battle for record ${recordId}`);
        }
      })
      .catch(err => reject(err));
  });
};

const getTenant = (tenantId) => {
  return client.getAsync(`tenants->${tenantId}`)
    .then(res => JSON.parse(res));
};

const getKeywordsByTenant = (tenantId) => {
  return getUserIds(tenantId)
    .then(userIds => userIds.map(userId => getUserKeywords(tenantId, userId)))
    .then(promises => Promise.all(promises))
    .then(keywords => _.flatten(keywords))
    .then(keywords => _.uniq(keywords));
};

const battleForFreeTenants = () => {
  return getTenantIds()
    .then(tenantIds => tenantIds.map(tenantId => battleForTenant(tenantId)))
    .then(promises => Promise.all(promises))
    .then(results => _.flatten(results));
};

const refreshTenantBattle = (tenantId) => {
  return client.expireAsync(`battle:tenants->${tenantId}`, expiration)
    .then(ok => true)
    .catch(err => false);
};

const refreshTenantExpiration = (tenantId) => {
  client.expireAsync(`tenants->${tenantId}`, expiration);
  client.expireAsync(`tenants:${tenantId}->users`, expiration);
  getUserIds(tenantId).then(userIds => userIds.forEach(userId => {
    client.expireAsync(`tenants:${tenantId}:users:${userId}->keywords`, expiration);
  }));
};

const refreshRecordExpiration = (recordId) => {
  client.expireAsync(`battle:record:${recordId}`, expiration);
};

const publishAnalyzedTweets = (tenantId, userId, analyzedTweets) => {
  const str = JSON.stringify(analyzedTweets);
  return client.publishAsync(`tenants:${tenantId}:users:${userId}->analyzedTweets`, str);
};

const flushDb = () => {
  return client.flushdbAsync()
    .then(res => true)
    .catch(err => false);
};

module.exports = {
  trackKeyword,
  trackKeywords,
  untrackKeyword,
  scheduleRecording,
  removeUser,
  publishAnalyzedTweets,
  getId,
  getTenant,
  refreshTenantExpiration,
  battleForFreeTenants,
  battleForTenant,
  refreshTenantBattle,
  battleForRecord,
  refreshRecordExpiration,
  getKeywordsByTenant,
  getTenantIds,
  getUserIds,
  getUserKeywords,
  getUserIdsByKeyword,
  flushDb
};
