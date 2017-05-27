const redisEvents = require('./redis_events');
const redisCommands = require('./redis_commands');

/*
some tests fail sometimes(!) because async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL

increasing timout interval does not help...

afterEach((done) => {
  redisCommands.flushDb().then(ok => done());
});

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
  expect.assertions(3);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  redisEvents.once('battleExpired', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, 'user', 'keyword')
    .then(res => {
      expect(res).toBeTruthy();
      return redisCommands.battleForTenant(id);
    })
    .then(battle => {
      expect(battle.wonBattle).toBeTruthy();
    });
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

test('keyword removed', (done) => {
  expect.assertions(2);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.once('keywordRemoved', (tenantId, userId) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    done();
  });
  redisCommands.trackKeyword(tenant, user, 'keyword')
    .then(ok => redisCommands.untrackKeyword(id, user, 'keyword'));
});

test('user removed', (done) => {
  expect.assertions(1);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.once('userRemoved', (tenantId) => {
    expect(tenantId).toEqual(id);
    done();
  });
  redisCommands.trackKeyword(tenant, user, 'keyword')
    .then(ok => redisCommands.removeUser(id, user));
});

test('subscribe', (done) => {
  expect.assertions(3);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.subscribe(id, 'user', (tenantId, userId, message) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    expect(message).toEqual({});
    redisEvents.unsubscribe(tenantId, userId);
    done();
  });
  redisCommands.publishAnalyzedTweets(id, user, {});
});


test('unsubscribe', (done) => {
  expect.assertions(3);

  const tenant = getSampleTenant();
  const id = redisCommands.getId(tenant);
  const user = 'user';
  redisEvents.subscribe(id, 'user', (tenantId, userId, message) => {
    expect(tenantId).toEqual(id);
    expect(userId).toEqual(user);
    expect(message).toEqual({});

    // unsubscribe
    redisEvents.unsubscribe(id, user);
    // then publish again
    redisCommands.publishAnalyzedTweets(id, user, {})
    // and wait 2 seconds, to ensure that this callback won't be called again
      .then(ok => setTimeout(done, 2000));
  });
  redisCommands.publishAnalyzedTweets(id, user, {});
});

  */