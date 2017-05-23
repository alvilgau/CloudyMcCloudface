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


test('track keyword', async () => {
  const t = getSampleTenant();

  let ok = await redisCommands.trackKeyword(t, 'user1', 'obama');
  expect(ok).toBeTruthy();

  ok = await redisCommands.trackKeyword(t, 'user2', 'obama');
  expect(ok).toBeTruthy();
});

test('untrack keyword', async () => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  await redisCommands.trackKeyword(t, 'user1', 'obama');
  const ok = await redisCommands.untrackKeyword(id, 'user1', 'obama');
  expect(ok).toBeTruthy();

});

test('get tenant ids', async () => {
  const t = getSampleTenant();

  let ids = await redisCommands.getTenantIds();
  expect(ids.length).toBe(0);

  await redisCommands.trackKeyword(t, 'user', 'keyword');
  ids = await redisCommands.getTenantIds();
  expect(ids.length).toBe(1);
});

test('get user ids', async () => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  let ids = await redisCommands.getUserIds(id);
  expect(ids.length).toBe(0);

  await redisCommands.trackKeyword(t, 'user', 'keyword');
  ids = await redisCommands.getUserIds(id);
  expect(ids.length).toBe(1);

  await redisCommands.trackKeyword(t, 'user2', 'keyword');
  ids = await redisCommands.getUserIds(id);
  expect(ids.length).toBe(2);

  await redisCommands.trackKeyword(t, 'user2', 'another-keyword');
  ids = await redisCommands.getUserIds(id);
  expect(ids.length).toBe(2);
});

test('get user keywords', async () => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  let keywords = await redisCommands.getUserKeywords(id, 'user');
  expect(keywords.length).toBe(0);

  await redisCommands.trackKeyword(t, 'user', 'my-keyword');
  keywords = await redisCommands.getUserKeywords(id, 'user');
  expect(keywords.length).toBe(1);
});

test('remove user', async () => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  await redisCommands.trackKeyword(t, 'user1', 'obama');
  let userIds = await redisCommands.getUserIds(id);
  expect(userIds.length).toBe(1);

  await redisCommands.removeUser(id, 'user1');
  userIds = await redisCommands.getUserIds(id);
  expect(userIds.length).toBe(0);
});

test('battle for tenant', async() => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  await redisCommands.trackKeyword(t, 'user', 'keyword');
  let result = await redisCommands.battleForTenant(id);
  expect(result.wonBattle).toBeTruthy();
  expect(result.tenant).toEqual(t);

  // only one battle will be successful
  result = await redisCommands.battleForTenant(id);
  expect(result.wonBattle).toBeFalsy();
  expect(result.tenant).toEqual(t);

});

test('battle for free tenants', async() => {

  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  await redisCommands.trackKeyword(t, 'user', 'keyword');
  await redisCommands.battleForFreeTenants();

  const result = await redisCommands.battleForTenant(id);
  expect(result.wonBattle).toBeFalsy();

});

test('get keywords by tenant', async () => {
  const t = getSampleTenant();
  const id = redisCommands.getId(t);

  let keywords = await redisCommands.getKeywordsByTenant(id);
  expect(keywords.length).toBe(0);

  await redisCommands.trackKeyword(t, 'user1', 'kw1');
  await redisCommands.trackKeyword(t, 'user2', 'kw1');
  await redisCommands.trackKeyword(t, 'user2', 'kw2');
  keywords = await redisCommands.getKeywordsByTenant(id);
  expect(keywords.length).toBe(2);
  expect(keywords).toContain('kw1');
  expect(keywords).toContain('kw2');
});