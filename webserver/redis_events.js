require('dotenv').config();
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});
const subscriber = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const db = process.env.REDIS_DB || 0;
const expiration = process.env.EXPIRATION || 3;
const keepAliveInterval = process.env.KEEP_ALIVE_INTERVAL || 1000;

// enable keyspace events
subscriber.config('set', 'notify-keyspace-events', 'KEA');

// callback when battle for tenant is won
let newTenantCallback = (tenantId) => {};
let tenantRemovedCallback = (tenantId) => {};
let userAddedCallback = (tenantId) => {};
let userRemovedCallback = (tenantId) => {};
let keywordAddedCallback = (tenantId, userId) => {};
let keywordRemovedCallback = (tenantId, userId) => {};
let battleExpiredCallback = (tenantId) => {};
let tenantExpiredCallback = (tenantId) => {};


// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(`${event}*`);

const expired = (redisKey) => {
  console.log(`redis key expired: ${redisKey}`);
  if (/battle:tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:battle:tenants->)/);
    const tenantId = splitted[1];
    battleExpiredCallback && battleExpiredCallback(tenantId);
  } else if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    tenantExpiredCallback && tenantExpiredCallback(tenantId);
  }
};

const set = (redisKey) => {
  console.log(`redis key was set: ${redisKey}`);
  if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    newTenantCallback && newTenantCallback(tenantId);
  }
};

const lpush = (redisKey) => {
  console.log(`value to redis key was pushed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    keywordAddedCallback && keywordAddedCallback(tenantId, userId);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    userAddedCallback && userAddedCallback(tenantId);
  }
};

const lrem = (redisKey) => {
  console.log(`redis key was removed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    keywordRemovedCallback && keywordAddedCallback(tenantId, userId);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    userRemovedCallback && userRemovedCallback(tenantId);
  }
};

const del = (redisKey) => {
  console.log(`redis key was deleted: ${redisKey}`);
  if (/tenant:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenant\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    keywordRemovedCallback && keywordRemovedCallback(tenantId, userId);
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

// handler for analyzed keywords
const subscriptions = [];
const getSubscription = (tenantId, userId) => {
  return subscriptions.filter(s => s.tenantId === tenantId && s.userId === userId);
};

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
