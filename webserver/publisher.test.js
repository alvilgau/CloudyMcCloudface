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
    expect.assertions(1);
    const t = getSampleTenant();
    publisher.trackKeyword(t, 'user1', 'obama')
        .then(res => {            
            expect(res).toBe(true);            
            done();
        });
});

test('untrack keyword', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();    
    publisher.untrackKeyword(t, 'user1', 'obama')
        .then(res => {            
            expect(res).toBe(true);            
            done();
        });
});

test('remove user', (done) => {
    expect.assertions(1);
    const t = getSampleTenant();    
    publisher.removeUser(t, 'user1')
        .then(res => {            
            expect(res).toBe(true);            
            done();
        });
});