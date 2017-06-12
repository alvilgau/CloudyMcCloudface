require('dotenv').config();
const EventEmitter = require('events');
const redis = require('redis');

const subscriber = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const psubscriber = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const db = process.env.REDIS_DB || 0;

// enable keyspace events
psubscriber.config('set', 'notify-keyspace-events', 'KEA');

const eventEmitter = new EventEmitter();

// subscribe for all events
const event = `__keyevent@${db}__:`;
psubscriber.psubscribe(`${event}*`);

const expired = (redisKey) => {
  console.log(`redis key expired: ${redisKey}`);
  if (/battle:tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:battle:tenants->)/);
    const tenantId = splitted[1];
    eventEmitter.emit('battleExpired', tenantId);
  } else if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    eventEmitter.emit('tenantRemoved', tenantId);
  }
  else if(/battle:record:\S+/.test(redisKey)) {
    const splitted = redisKey.split('battle:record:');
    const recordId = splitted[1];
    eventEmitter.emit('recordBattleExpired', recordId);
  }
  else if(/record:\S+:\S+/.test(redisKey)) {
    const splitted = redisKey.split(':');
    const type = splitted[1];
    const recordId = splitted[2];
    if (type === 'start') {
      eventEmitter.emit('startRecord', recordId);
    } else if (type === 'stop') {
      eventEmitter.emit('stopRecord', recordId);
    }
  }
};

const set = (redisKey) => {
  console.log(`redis key was set: ${redisKey}`);
  if (/tenants->\S+/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants->)/);
    const tenantId = splitted[1];
    eventEmitter.emit('newTenant', tenantId);
  }
};

const lpush = (redisKey) => {
  console.log(`value to redis key was pushed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    eventEmitter.emit('keywordAdded', tenantId, userId);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    eventEmitter.emit('userAdded', tenantId);
  }
};

const lrem = (redisKey) => {
  console.log(`redis key was removed: ${redisKey}`);
  if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    eventEmitter.emit('keywordRemoved', tenantId, userId);
  } else if (/tenants:\S+->users/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenants\:|->users)/);
    const tenantId = splitted[1];
    eventEmitter.emit('userRemoved', tenantId);
  }
};

const del = (redisKey) => {
  console.log(`redis key was deleted: ${redisKey}`);
  if (/tenant:\S+:users:\S+->keywords/.test(redisKey)) {
    const splitted = redisKey.split(/(?:tenant\:|\:users\:|->keywords)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    eventEmitter.emit('keywordRemoved', tenantId, userId);
  }
};

const pmessageHandlers = {
  expired, set, lpush, lrem, del,
};
psubscriber.on('pmessage', (pattern, channel, msg) => {
  const msgType = channel.replace(event, '');
  const handler = pmessageHandlers[msgType];
  if (handler) {
    handler(msg);
  }
});

// handler for analyzed keywords
const subscriptions = [];
const getSubscription = (tenantId, userId) => {
  return subscriptions.find(s => s.tenantId === tenantId && s.userId === userId);
};

subscriber.on('message', (channel, message) => {
  if (/tenants:\S+:users:\S+->analyzedTweets/.test(channel)) {
    const splitted = channel.split(/(?:tenants\:|\:users\:|->analyzedTweets)/);
    const tenantId = splitted[1];
    const userId = splitted[2];
    const subscription = getSubscription(tenantId, userId);
    if (subscription) {
      const msg = JSON.parse(message);
      subscription.callback(tenantId, userId, msg);
    }
  }
});

eventEmitter.unsubscribe = (tenantId, userId) => {
  const subscription = getSubscription(tenantId, userId);
  if (subscription) {
    const index = subscriptions.indexOf(subscription);
    subscriptions.splice(index, 1);
  }
};

eventEmitter.subscribe = (tenantId, userId, callback) => {
  eventEmitter.unsubscribe(tenantId, userId);
  subscriptions.push({tenantId, userId, callback});
  subscriber.subscribe(`tenants:${tenantId}:users:${userId}->analyzedTweets`);
};

module.exports = eventEmitter;