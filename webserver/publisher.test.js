const publisher = require('./publisher');
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

afterEach((done) => {
    redisClient.flushdb(done);        
});

test('track keyword', (done) => {    
    const t = getSampleTenant();
    const id = publisher.pubsubutil.getId(t);
    publisher.trackKeyword(t, 'user1', 'obama')
        .then(ok => {            
            expect(ok).toBe(true);               
            expect(publisher.pubsubutil.getTenantIds().length).toBe(1);        
            expect(publisher.pubsubutil.getUserIds(id).length).toBe(1);
            expect(publisher.pubsubutil.getKeywordsByTenant(id).size).toBe(1);            
            done();
        });
});

test('untrack keyword', (done) => {    
    const t = getSampleTenant();    
    const id = publisher.pubsubutil.getId(t);
    publisher.trackKeyword(t, 'user1', 'obama')
        .then(ok => publisher.untrackKeyword(t, 'user1', 'obama'))
        .then(ok => {
            expect(ok).toBe(true);            
            expect(publisher.pubsubutil.getTenantIds().length).toBe(1);        
            expect(publisher.pubsubutil.getUserIds(id).length).toBe(1);
            expect(publisher.pubsubutil.getKeywordsByTenant(id).size).toBe(0);            
            done();
        });   
});

test('remove user', (done) => {
    const t = getSampleTenant();    
    const id = publisher.pubsubutil.getId(t);
    publisher.trackKeyword(t, 'user1', 'obama')
        .then(ok => publisher.trackKeyword(t, 'user2', 'clinton'))
        .then(ok => {
            expect(publisher.pubsubutil.getTenantIds().length).toBe(1);        
            expect(publisher.pubsubutil.getUserIds(id).length).toBe(2);
            expect(publisher.pubsubutil.getKeywordsByTenant(id).size).toBe(2);            
            return publisher.removeUser(t, 'user1');
        })
        .then(ok => {
            expect(publisher.pubsubutil.getTenantIds().length).toBe(1);        
            expect(publisher.pubsubutil.getUserIds(id).length).toBe(1);
            expect(publisher.pubsubutil.getKeywordsByTenant(id).size).toBe(1);            
            return publisher.removeUser(t, 'user2');
        })
        .then(ok => {
            expect(publisher.pubsubutil.getTenantIds().length).toBe(0);        
            expect(publisher.pubsubutil.getUserIds(id).length).toBe(0);
            expect(publisher.pubsubutil.getKeywordsByTenant(id).size).toBe(0);            
            done();
        });
});