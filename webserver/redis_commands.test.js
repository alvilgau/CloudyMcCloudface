const redisCommands = require('./redis_commands');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const redisClient = redis.createClient();
redisClient.config('set', 'notify-keyspace-events', 'KEA');

const getSampleTenant = () => {
  const t = {
    consumerKey: 'my-consumerKey',
    token: 'my-token',
    consumerSecret: 'my-consumerSecret',
    tokenSecret: 'my-tokenSecret',
  };
  return t;
};

afterEach((done) => {
  redisClient.flushdb(done);
});

test('track keyword', (done) => {
  const t = getSampleTenant();
  const id = redisCommands.tenants.getId(t);
  redisCommands.trackKeyword(t, 'user1', 'obama')
        .then((ok) => {
          expect(ok).toBe(true);
          expect(redisCommands.tenants.getTenantIds().length).toBe(1);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(1);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(1);
          done();
        });
});

test('untrack keyword', (done) => {
  const t = getSampleTenant();
  const id = redisCommands.tenants.getId(t);
  redisCommands.trackKeyword(t, 'user1', 'obama')
        .then(ok => redisCommands.untrackKeyword(t, 'user1', 'obama'))
        .then((ok) => {
          expect(ok).toBe(true);
          expect(redisCommands.tenants.getTenantIds().length).toBe(1);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(1);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(0);
          done();
        });
});

test('remove user', (done) => {
  const t = getSampleTenant();
  const id = redisCommands.tenants.getId(t);
  redisCommands.trackKeyword(t, 'user1', 'obama')
        .then(ok => redisCommands.trackKeyword(t, 'user2', 'clinton'))
        .then(ok => redisCommands.trackKeyword(t, 'user3', 'clinton'))
        .then((ok) => {
          expect(redisCommands.tenants.getTenantIds().length).toBe(1);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(3);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(2);
          return redisCommands.removeUser(t, 'user1');
        })
        .then((ok) => {
          expect(redisCommands.tenants.getTenantIds().length).toBe(1);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(2);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(1);
          return redisCommands.removeUser(t, 'user2');
        })
        .then((ok) => {
          expect(redisCommands.tenants.getTenantIds().length).toBe(1);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(1);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(1);
          return redisCommands.removeUser(t, 'user3');
        })
        .then((ok) => {
          expect(redisCommands.tenants.getTenantIds().length).toBe(0);
          expect(redisCommands.tenants.getUserIds(id).length).toBe(0);
          expect(redisCommands.tenants.getKeywordsByTenant(id).size).toBe(0);
          done();
        });
});
