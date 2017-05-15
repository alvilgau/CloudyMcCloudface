const pubsubutil = require('./pubsubutil');

const getSampleTenant = () => {
    const t = {
        consumerKey: 'my-consumerKey',
        token: 'my-token',
        consumerSecret: 'my-consumerSecret',
        tokenSecret: 'my-tokenSecret'        
    };
    return t;
};

afterEach(() => {
    pubsubutil.clear();
});

test('get tenant id', () => {
    const t = getSampleTenant();
    expect(pubsubutil.getId(t)).toEqual(t.consumerKey);
});

test('add keyword', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    pubsubutil.addKeyword(t, 'user1', 'trump');
    expect(pubsubutil.getKeywordsByUser(id, 'user1')).toContain('trump');
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(1);
    
    // add same keyword again
    pubsubutil.addKeyword(t, 'user1', 'trump');    
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(1);

    // add keywords for another user
    pubsubutil.addKeyword(t, 'user2', 'clinton');
    expect(pubsubutil.getKeywordsByUser(id, 'user2')).toContain('clinton');
    expect(pubsubutil.getKeywordsByUser(id, 'user2').size).toEqual(1);
});

test('get keywords by user', () => {
    const t = getSampleTenant();    
    const id = pubsubutil.getId(t);
    pubsubutil.addKeyword(t, 'user1', 'trump');      
    expect(pubsubutil.getKeywordsByUser(id, 'user1')).toContain('trump');
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(1);

    expect(pubsubutil.getKeywordsByUser(id, 'no-such-user').size).toEqual(0);
});

test('get keywords by tenant', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    expect(pubsubutil.getKeywordsByTenant(id).size).toEqual(0);
    
    pubsubutil.addKeyword(t, 'user1', 'trump');  
    pubsubutil.addKeyword(t, 'user2', 'clinton');  
    const keywords = pubsubutil.getKeywordsByTenant(id);
    expect(keywords.size).toEqual(2);
    expect(keywords).toContain('trump');
    expect(keywords).toContain('clinton');
});

test('remove keyword', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    pubsubutil.addKeyword(t, 'user1', 'trump');    
    expect(pubsubutil.getKeywordsByTenant(id).size).toEqual(1);  
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(1);  
    pubsubutil.removeKeyword(id, 'user1', 'trump');
    expect(pubsubutil.getKeywordsByTenant(id).size).toEqual(0);  
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(0);  
});

test('remove user', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    pubsubutil.addKeyword(t, 'user1', 'trump');
    pubsubutil.removeUser(id, 'user1');
    // make sure keywords are removed when user is removed
    expect(pubsubutil.getKeywordsByTenant(id).size).toEqual(0);  
    expect(pubsubutil.getKeywordsByUser(id, 'user1').size).toEqual(0);  
});

test('has users', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    expect(pubsubutil.hasUsers(id)).toBeFalsy();
    pubsubutil.addKeyword(t, 'user1', 'clinton');
    expect(pubsubutil.hasUsers(id)).toBeTruthy();
    pubsubutil.removeKeyword(id, 'user1');
    expect(pubsubutil.hasUsers(id)).toBeTruthy();
    pubsubutil.removeUser(id, 'user1');
    expect(pubsubutil.hasUsers(id)).toBeFalsy();
});

test('remove tenant', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    pubsubutil.addKeyword(t, 'user1', 'obama');
    expect(pubsubutil.getTenantIds().length).toBe(1);
    pubsubutil.removeTenant(id);
    expect(pubsubutil.getTenantIds().length).toBe(0);
});

test('get tenant ids', () => {
    expect(pubsubutil.getTenantIds().length).toBe(0);
    const t = getSampleTenant();
    pubsubutil.addKeyword(t, 'user1', 'cloudy-mc-cloudface');
    expect(pubsubutil.getTenantIds().length).toBe(1);
    expect(pubsubutil.getTenantIds()).toContain(pubsubutil.getId(t));
});

test('get user ids', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    expect(pubsubutil.getUserIds(t).length).toBe(0);
    pubsubutil.addKeyword(t, 'user1', 'cloudy-mc-cloudface');
    expect(pubsubutil.hasUsers(id)).toBeTruthy();
    expect(pubsubutil.getUserIds(id).length).toBe(1);
    expect(pubsubutil.getUserIds(id)).toContain('user1');
});

test('add tenant', () => {
    const t = getSampleTenant();
    pubsubutil.addTenant(t);
    expect(pubsubutil.getTenantIds(t).length).toBe(1);    
});

test('get tenant', () => {
    expect(pubsubutil.getTenant('no-such-id')).toBeUndefined();
    const t = getSampleTenant();    
    pubsubutil.addTenant(t);
    const id = pubsubutil.getId(t);
    expect(pubsubutil.getTenant(id)).toEqual(t);
});

test('add user', () => {
    pubsubutil.addUser('no-such-tenant', 'userX');
    expect(pubsubutil.getUserIds().length).toBe(0);
    const t = getSampleTenant();
    pubsubutil.addTenant(t);
    const id = pubsubutil.getId(t);
    pubsubutil.addUser(id, 'userX');
    expect(pubsubutil.getUserIds(id).length).toBe(1);
    expect(pubsubutil.getUserIds(id)).toContain('userX');
});

test('tenant exists', () => {
    const t = getSampleTenant();
    const id = pubsubutil.getId(t);
    expect(pubsubutil.tenantExists(id)).toBeFalsy();
    pubsubutil.addTenant(t);
    expect(pubsubutil.tenantExists(id)).toBeTruthy();
});