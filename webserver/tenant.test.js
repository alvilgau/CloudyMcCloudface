const tenant = require('./tenant');
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
        tokenSecret: 'my-tokenSecret'        
    };
    return t;
}

const getSampleTenant2 = () => {
    const t2 = {
        consumerKey: 'my-consumerKey2',
        token: 'my-token2',
        consumerSecret: 'my-consumerSecret2',
        tokenSecret: 'my-tokenSecret2'        
    };
    return t2;
};

const getSampleUser = () => {
    return "sample-user";
}

const getSampleUser2 = () => {
    return "sample-user2";
};

afterEach((done) => {
    tenant.onNewTenant(null);    
    tenant.onKeywordRemoved(null);
    tenant.onKeywordAdded(null);
    redisClient.flushdb(done);        
});

test('battle for tenant', (done) => {
    expect.assertions(1);    
    const sampleTenant = getSampleTenant();
    tenant.onNewTenant((t) => {                        
        expect(t).toEqual(sampleTenant);                
        done();
    });    
    
    const consumerKey = sampleTenant.consumerKey;
    redisClient.setAsync(`tenant:${consumerKey}`, JSON.stringify(sampleTenant));
});

test('create tenant', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    tenant.createTenant(t)
        .then(res => {            
            expect(res).toBe(true);            
            done();
        });
});

test('get tenant keys', async (done) => {
    expect.assertions(3);
    const t1 = getSampleTenant();
    const t2 = getSampleTenant2();
    await tenant.createTenant(t1);
    await tenant.createTenant(t2);
    await tenant.createTenant(t2);
    await tenant.createTenant(t2);
    tenant.getTenantKeys().then(keys => {
        expect(keys).toContain(t1.consumerKey);
        expect(keys).toContain(t2.consumerKey);
        expect(keys.size).toEqual(2);
        done();
    });
});

test('add user', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    const u = getSampleUser();
    tenant.addUser(t, u)
        .then(res => {
            expect(res).toBe(true);
            done();
        });
});

test('remove user', async () => {
    expect.assertions(2);
    const t = getSampleTenant();
    const u = getSampleUser();
    const res1 = await tenant.addUser(t, u);
    expect(res1).toBe(true);
    const res2 = await tenant.removeUser(t, u);
    expect(res2).toBe(true);        
});

test('add keyword', async () => {
    expect.assertions(2);
    const t = getSampleTenant();
    const u = getSampleUser();
    const res1 = await tenant.addUser(t, u);    
    expect(res1).toBe(true);
    const res2 = await tenant.addKeyword(t, u, 'my-keyword')
    expect(res2).toBe(true);    
});

test('remove keyword', async () => {
    expect.assertions(3);
    const t = getSampleTenant();
    const u = getSampleUser();
    const res1 = await tenant.addUser(t, u);    
    expect(res1).toBe(true);
    const res2 = await tenant.addKeyword(t, u, 'my-keyword')
    expect(res2).toBe(true); 
    const res3 = await tenant.removeKeyword(t, u, 'my-keyword');
    expect(res3).toBe(true);
});

test('add keyword callback', async (done) => {    
    const t = getSampleTenant();
    const u = getSampleUser();    
    const res1 = await tenant.createTenant(t);
    tenant.onKeywordAdded((theTenant, keywords) => {
        expect(keywords.size).toBe(1);
        expect(keywords).toContain('my-keyword');        
        done();
    });
    await tenant.addKeyword(t, u, 'my-keyword');        
});

test('remove keyword callback', async (done) => {
    expect.assertions(1);
    const t = getSampleTenant();
    const u = getSampleUser();    
    const res1 = await tenant.createTenant(t);
    tenant.onKeywordRemoved((theTenant, keywords) => {        
        expect(keywords.size).toBe(0);        
        done();
    });
    await tenant.addKeyword(t, u, 'my-keyword');
    await tenant.removeKeyword(t, u, 'my-keyword');
});

test('get keywords by tenant', async (done) => {    
    const t = getSampleTenant();
    const u = getSampleUser();
    await tenant.addKeyword(t, u, 'my-keyword');
    await tenant.addKeyword(t, u, 'my-keyword');
    await tenant.addKeyword(t, u, 'another-keyword');
    await tenant.addKeyword(t, u, 'another-keyword');
    tenant.getKeywordsByTenant(t).then(keywords => {
        expect(keywords).toContain('my-keyword');
        expect(keywords).toContain('another-keyword');        
        done();
    });    
});

test('get keywords by user', async (done) => {
    const t = getSampleTenant();
    const u1 = getSampleUser();
    const u2 = getSampleUser2();
    await tenant.addKeyword(t, u1, 'user1-keyword1');
    await tenant.addKeyword(t, u1, 'user1-keyword2');
    await tenant.addKeyword(t, u2, 'user2-keyword1');
    await tenant.addKeyword(t, u2, 'user2-keyword2');
    tenant.getKeywordsByUser(t, u2).then(keywords => {
        expect(keywords).toContain('user2-keyword1');
        expect(keywords).toContain('user2-keyword2');
        expect(keywords).not.toContain('user1-keyword1');
        expect(keywords).not.toContain('user1-keyword2');
        done();
    });    
});

