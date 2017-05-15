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
    pubsubutil.addKeyword(t, 'user1', 'trump');
    expect(pubsubutil.getKeywordsByUser(t, 'user1')).toContain('trump');
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(1);
    
    // add same keyword again
    pubsubutil.addKeyword(t, 'user1', 'trump');    
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(1);

    // add keywords for another user
    pubsubutil.addKeyword(t, 'user2', 'clinton');
    expect(pubsubutil.getKeywordsByUser(t, 'user2')).toContain('clinton');
    expect(pubsubutil.getKeywordsByUser(t, 'user2').size).toEqual(1);
});

test('get keywords by user', () => {
    const t = getSampleTenant();    
    pubsubutil.addKeyword(t, 'user1', 'trump');      
    expect(pubsubutil.getKeywordsByUser(t, 'user1')).toContain('trump');
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(1);

    expect(pubsubutil.getKeywordsByUser(t, 'no-such-user').size).toEqual(0);
});

test('get keywords by tenant', () => {
    const t = getSampleTenant();
    expect(pubsubutil.getKeywordsByTenant(t).size).toEqual(0);
    
    pubsubutil.addKeyword(t, 'user1', 'trump');  
    pubsubutil.addKeyword(t, 'user2', 'clinton');  
    const keywords = pubsubutil.getKeywordsByTenant(t);
    expect(keywords.size).toEqual(2);
    expect(keywords).toContain('trump');
    expect(keywords).toContain('clinton');
});

test('remove keyword', () => {
    const t = getSampleTenant();
    pubsubutil.addKeyword(t, 'user1', 'trump');    
    expect(pubsubutil.getKeywordsByTenant(t).size).toEqual(1);  
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(1);  
    pubsubutil.removeKeyword(t, 'user1', 'trump');
    expect(pubsubutil.getKeywordsByTenant(t).size).toEqual(0);  
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(0);  
});

test('remove user', () => {
    const t = getSampleTenant();
    pubsubutil.addKeyword(t, 'user1', 'trump');
    pubsubutil.removeUser(t, 'user1');
    // make sure keywords are removed when user is removed
    expect(pubsubutil.getKeywordsByTenant(t).size).toEqual(0);  
    expect(pubsubutil.getKeywordsByUser(t, 'user1').size).toEqual(0);  
});

test('has users', () => {
    const t = getSampleTenant();
    expect(pubsubutil.hasUsers(t)).toBeFalsy();
    pubsubutil.addKeyword(t, 'user1', 'clinton');
    expect(pubsubutil.hasUsers(t)).toBeTruthy();
    pubsubutil.removeKeyword(t, 'user1');
    expect(pubsubutil.hasUsers(t)).toBeTruthy();
    pubsubutil.removeUser(t, 'user1');
    expect(pubsubutil.hasUsers(t)).toBeFalsy();
});

test('remove tenant', () => {
    const t = getSampleTenant();
    pubsubutil.addKeyword(t, 'user1', 'obama');
    expect(pubsubutil.getTenantIds().length).toBe(1);
    pubsubutil.removeTenant(t);
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
    expect(pubsubutil.hasUsers(t)).toBeTruthy();
    expect(pubsubutil.getUserIds(id).length).toBe(1);
    expect(pubsubutil.getUserIds(id)).toContain('user1');
});