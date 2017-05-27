const redisEvents = require('./redis_events');
const redisCommands = require('./redis_commands');

const getSampleTenant = () => {
  const t = {
    consumerKey: 'my-consumerKey',
    token: 'my-token',
    consumerSecret: 'my-consumerSecret',
    tokenSecret: 'my-tokenSecret',
  };
  return t;
};

test('battle expired', (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  redisEvents.once('battleExpired', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, 'user', 'keyword');
  redisCommands.battleForTenant(id);
});

test('tenant expired', (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  redisEvents.once('tenantExpired', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, 'user', 'keyword');
});

test('new tenant', (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  redisEvents.once('newTenant', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, 'user', 'keyword');
});

test('keyword added', (done) => {
  expect.assertions(2);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.once('keywordAdded', (tenantId, userId) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    done();
  });
  redisCommands.trackKeyword(tenant, user, 'keyword');
});

test('user added', (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  redisEvents.once('userAdded', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, 'user', 'keyword');
});

test('keyword removed', async (done) => {
  expect.assertions(2);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.once('keywordRemoved', (tenantId, userId) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    done();
  });
  await redisCommands.trackKeyword(tenant, user, 'keyword');
  redisCommands.untrackKeyword(id, user, 'keyword');
});

test('user removed', async (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.once('userRemoved', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  await redisCommands.trackKeyword(tenant, user, 'keyword');
  redisCommands.removeUser(id, user);
});

test('subscribe', async (done) => {
  expect.assertions(3);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.subscribe(id, 'user', (tenantId, userId, message) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    expect(message).toEqual({});
    done();
  });
  redisCommands.publishAnalyzedTweets(id, user, {});
});

test('unsubscribe', async () => {
  expect.assertions(3);
  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.subscribe(id, 'user', (tenantId, userId, message) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    expect(message).toEqual({});
  });
  await redisCommands.publishAnalyzedTweets(id, user, {});

  // unsubscribe
  redisEvents.unsubscribe(id, user);
  // then publish again
  await redisCommands.publishAnalyzedTweets(id, user, {});
});