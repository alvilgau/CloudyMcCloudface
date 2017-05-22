const tenants = require('./tenants');

const getSampleTenant = () => {
  const t = {
    consumerKey: 'my-consumerKey',
    token: 'my-token',
    consumerSecret: 'my-consumerSecret',
    tokenSecret: 'my-tokenSecret',
  };
  return t;
};

afterEach(() => {
  tenants.clear();
});

test('get tenant id', () => {
  const t = getSampleTenant();
  expect(tenants.getId(t)).toEqual(t.consumerKey);
});

test('add keyword', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  tenants.addKeyword(t, 'user1', 'trump');
  expect(tenants.getKeywordsByUser(id, 'user1')).toContain('trump');
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(1);

    // add same keyword again
  tenants.addKeyword(t, 'user1', 'trump');
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(1);

    // add keywords for another user
  tenants.addKeyword(t, 'user2', 'clinton');
  expect(tenants.getKeywordsByUser(id, 'user2')).toContain('clinton');
  expect(tenants.getKeywordsByUser(id, 'user2').size).toEqual(1);
});

test('get keywords by user', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  tenants.addKeyword(t, 'user1', 'trump');
  expect(tenants.getKeywordsByUser(id, 'user1')).toContain('trump');
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(1);

  expect(tenants.getKeywordsByUser(id, 'no-such-user').size).toEqual(0);
});

test('get keywords by tenant', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  expect(tenants.getKeywordsByTenant(id).size).toEqual(0);

  tenants.addKeyword(t, 'user1', 'trump');
  tenants.addKeyword(t, 'user2', 'clinton');
  const keywords = tenants.getKeywordsByTenant(id);
  expect(keywords.size).toEqual(2);
  expect(keywords).toContain('trump');
  expect(keywords).toContain('clinton');
});

test('remove keyword', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  tenants.addKeyword(t, 'user1', 'trump');
  expect(tenants.getKeywordsByTenant(id).size).toEqual(1);
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(1);
  tenants.removeKeyword(id, 'user1', 'trump');
  expect(tenants.getKeywordsByTenant(id).size).toEqual(0);
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(0);
});

test('remove user', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  tenants.addKeyword(t, 'user1', 'trump');
  tenants.removeUser(id, 'user1');
    // make sure keywords are removed when user is removed
  expect(tenants.getKeywordsByTenant(id).size).toEqual(0);
  expect(tenants.getKeywordsByUser(id, 'user1').size).toEqual(0);
});

test('has users', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  expect(tenants.hasUsers(id)).toBeFalsy();
  tenants.addKeyword(t, 'user1', 'clinton');
  expect(tenants.hasUsers(id)).toBeTruthy();
  tenants.removeKeyword(id, 'user1');
  expect(tenants.hasUsers(id)).toBeTruthy();
  tenants.removeUser(id, 'user1');
  expect(tenants.hasUsers(id)).toBeFalsy();
});

test('remove tenant', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  tenants.addKeyword(t, 'user1', 'obama');
  expect(tenants.getTenantIds().length).toBe(1);
  tenants.removeTenant(id);
  expect(tenants.getTenantIds().length).toBe(0);
});

test('get tenant ids', () => {
  expect(tenants.getTenantIds().length).toBe(0);
  const t = getSampleTenant();
  tenants.addKeyword(t, 'user1', 'cloudy-mc-cloudface');
  expect(tenants.getTenantIds().length).toBe(1);
  expect(tenants.getTenantIds()).toContain(tenants.getId(t));
});

test('get user ids', () => {
  const t = getSampleTenant();
  const id = tenants.getId(t);
  expect(tenants.getUserIds(t).length).toBe(0);
  tenants.addKeyword(t, 'user1', 'cloudy-mc-cloudface');
  expect(tenants.hasUsers(id)).toBeTruthy();
  expect(tenants.getUserIds(id).length).toBe(1);
  expect(tenants.getUserIds(id)).toContain('user1');
});

test('add tenant', () => {
  const t = getSampleTenant();
  tenants.addTenant(t);
  expect(tenants.getTenantIds(t).length).toBe(1);
});

test('get tenant', () => {
  expect(tenants.getTenant('no-such-id')).toBeUndefined();
  const t = getSampleTenant();
  tenants.addTenant(t);
  const id = tenants.getId(t);
  // when you add a tenant, then it will create an empty user array
  t.users = [];
  expect(tenants.getTenant(id)).toEqual(t);
});

test('add user', () => {
  tenants.addUser('no-such-tenant', 'userX');
  expect(tenants.getUserIds().length).toBe(0);
  const t = getSampleTenant();
  tenants.addTenant(t);
  const id = tenants.getId(t);
  tenants.addUser(id, 'userX');
  expect(tenants.getUserIds(id).length).toBe(1);
  expect(tenants.getUserIds(id)).toContain('userX');
});
