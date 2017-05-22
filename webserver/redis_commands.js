require('dotenv').config();
const redis = require('redis');
const bluebird = require('bluebird');
const tenants = require('./tenants');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient();

const expiration = process.env.EXPIRATION || 3;
const keepAliveInterval = process.env.KEEP_ALIVE_INTERVAL || 1000;

const trackKeyword = (tenant, userId, keyword) => {
  const tenantId = tenants.getId(tenant);
  return client.multi()
            .set(`tenants->${tenantId}`, JSON.stringify(tenant))
            .expire(`tenants->${tenantId}`, expiration)
            .lpush(`tenants:${tenantId}->users`, userId)
            .expire(`tenants:${tenantId}->users`, expiration)
            .lpush(`tenants:${tenantId}:users:${userId}->keywords`, keyword)
            .expire(`tenants:${tenantId}:users:${userId}->keywords`, expiration)
            .execAsync()
            .then((ok) => {
              tenants.addKeyword(tenant, userId, keyword);
              return true;
            })
            .catch(err => false);
};

const untrackKeyword = (tenant, userId, keyword) => {
  const tenantId = tenants.getId(tenant);
  return client.lremAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, keyword)
            .then((ok) => {
              tenants.removeKeyword(tenantId, userId, keyword);
              return true;
            })
            .catch(err => false);
};

const removeUser = (tenant, userId) => {
  const tenantId = tenants.getId(tenant);
  return client.multi()
            .lrem(`tenants:${tenantId}->users`, 0, userId)
            .del(`tenants:${tenantId}:users:${userId}->keywords`)
            .execAsync()
            .then((ok) => {
              tenants.removeUser(tenantId, userId);
              if (!tenants.hasUsers(tenantId)) {
                    // there are no more users for this tenant -> remove tenant
                    // redis will do the rest ...
                tenants.removeTenant(tenantId);
              }
              return true;
            })
            .catch(err => false);
};

const refreshExpiration = (tenantId) => {
  client.expireAsync(`tenants->${tenantId}`, expiration);
  client.expireAsync(`tenants:${tenantId}->users`, expiration);
  tenants.getUserIds(tenantId).forEach((userId) => {
      client.expireAsync(`tenants:${tenantId}:users:${userId}->keywords`, expiration);
    });
};

const redisCommands = {
  trackKeyword,
  untrackKeyword,
  removeUser,
  refreshExpiration,
  keepAliveInterval,
  tenants,
};
module.exports = redisCommands;
