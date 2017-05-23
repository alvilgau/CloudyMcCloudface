require('dotenv').config();
const redis = require('redis');
const bluebird = require('bluebird');
const _ = require('lodash');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();

const expiration = process.env.EXPIRATION;

const getId = (tenant) => {
  return tenant.consumerKey;
};

const trackKeyword = (tenant, userId, keyword) => {
  const tenantId = getId(tenant);
  return client.multi()
            .set(`tenants->${tenantId}`, JSON.stringify(tenant))
            .expire(`tenants->${tenantId}`, expiration)
            .lpush(`tenants:${tenantId}->users`, userId)
            .expire(`tenants:${tenantId}->users`, expiration)
            .lpush(`tenants:${tenantId}:users:${userId}->keywords`, keyword)
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
    .then((res) => {
      const redisKeys = res[1];
      return redisKeys.map(key => key.replace('tenants->', ''));
    })
    .catch((err) => {
      console.error('could not query tenant ids from redis');
      console.error(err);
      return [];
    });
};

const getUserIds = (tenantId) => {
  return client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
            .then(ids => _.uniq(ids))
            .catch((err) => {
              console.error(`could not query user ids for tenant ${tenantId} from redis`);
              console.error(err);
              return [];
            });
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
      .then((res) => {
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
          console.log(`lost battle for tenant ${tenant}`);
        }
      })
      .catch(err => reject(err));
  });
};

const getKeywordsByTenant = (tenantId) => {
      return getUserIds(tenantId)
        .then(userIds => userIds.map(userId => getUserKeywords(tenantId, userId)))
        .then(promises => Promise.all(promises))
        .then(keywords => _.flatten(keywords))
        .then(keywords => _.uniq(keywords));
};

const battleForFreeTenants = () => {
  getTenantIds().then(ids => ids.map(id => battleForTenant(id)));
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

const publishAnalyzedTweets = (tenantId, userId, analyzedTweets) => {
  const str = JSON.stringify(analyzedTweets);
  client.publishAsync(`tenants:{tenantId}:users:${userId}->analyzedTweets`, str);
};

module.exports = {
  trackKeyword,
  untrackKeyword,
  removeUser,
  publishAnalyzedTweets,
  getId,
  refreshTenantExpiration,
  battleForFreeTenants,
  refreshTenantBattle,
  getKeywordsByTenant,
  getTenantIds,
  getUserIds,
  getUserKeywords
};