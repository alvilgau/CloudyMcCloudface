const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient(); 
const subscriber = redis.createClient();

// todo: read from env
const db = 0;
const expirationInSeconds = 3;
const keepAliveInterval = ((expirationInSeconds-1) * 1000) / 2;

// enable keyspace events
subscriber.config('set', 'notify-keyspace-events', 'KEA');

const tenants = [];

// callback when battle for tenant is won
let cb = null;

// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(event + '*');

const battleForTenant = (tenant) => {    
    client.multi()
        .incr(`battle:tenant:${tenant}`)
        .expire(`battle:tenant:${tenant}`, expirationInSeconds)        
        .execAsync()
        .then(res => {
            // get result from incr command
            const battleCounter = res[0];          
            // only one service will receive counter == 1
            if (battleCounter == 1) {
                console.log(`won battle for tenant ${tenant}`);
                tenants.push(tenant);                
                if (cb) {                    
                    client.getAsync(`tenant:${tenant}`)
                          .then(tenantValue => cb(tenantValue));                    
                }                                
            } else {
                console.log(`lost battle for tenant ${tenant}`);
            } 
        });
};

const expired = (redisVar) => {    
    if (redisVar.startsWith('battle:tenant:')) {
        // other service is down probably
        const tenant = redisVar.replace('battle:tenant:', '');
        battleForTenant(tenant);
    }
};

const set = (redisVar) => {
    if (redisVar.startsWith('tenant:')) {
        const tenant = redisVar.replace('tenant:', '');
        battleForTenant(tenant);
    }    
};

const pmessageHandlers = {
    expired, set
};
subscriber.on('pmessage', (pattern, channel, msg) => {            
    const msgType = channel.replace(event, '');    
    const handler = pmessageHandlers[msgType];    
    if (handler) {
        handler(msg);
    }
});

// subscribe for custom messages
const messageHandlers = {
    /*'newTenant': battleForTenant*/
};
Object.keys(messageHandlers).forEach(handler => subscriber.subscribe(handler));
subscriber.on('message', (channel, msg) => {    
    const handler = messageHandlers[channel];    
    if (handler) {
        handler(msg);
    }
});

const battleForFreeTenants = () => {
    client.scanAsync('0', 'MATCH', 'tenant:*')
    .then(results => results[1])
    .then(tenants => tenants.forEach(tenant => battleForTenant(tenant)));
};

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 */
const createTenant = (tenant) => {
    const consumerKey = tenant.consumerKey;
    return client.setAsync(`tenant:${consumerKey}`, JSON.stringify(tenant))
                .then(res => true)
                .catch(err => false);
};

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 * @param  {} user id
 */
const addUser = (tenant, user) => {
    const consumerKey = tenant.consumerKey;
    return client.setAsync(`tenant:${consumerKey}:user:${user}`, user)
                .then(res => true)
                .catch(err => false);
};

const removeUser = (tenant, user) => {
    const consumerKey = tenant.consumerKey;
    return client.multi()
                .del(`tenant:${consumerKey}:user:${user}`)
                .del(`tenant:${consumerKey}:user:${user}:keywords`)
                .execAsync()
                .then(res => true)
                .catch(err => false);
};

const addKeyword = (tenant, user, keyword) => {
    const consumerKey = tenant.consumerKey;
    return client.lpushAsync(`tenant:${consumerKey}:user:${user}:keywords`, keyword)
                .then(res => true)
                .catch(res => false);
};

const removeKeyword = (tenant, user, keyword) => {
    const consumerKey = tenant.consumerKey;
    return client.lremAsync(`tenant:${consumerKey}:user:${user}:keywords`, 0, keyword)
                .then(res => true)
                .catch(err => false);
}

// install job for updating battles
let interval;
const start = () => {
    interval = setInterval(() => {
        tenants.forEach(tenant => {      
            client.expireAsync(`battle:tenant:${tenant}`, expirationInSeconds);
        });
    }, keepAliveInterval)
};
start();

const stop = () => {    
    tenants.length = 0;
    clearInterval(interval);
};

const tenant = {
    battleForFreeTenants,        
    handleNewTenant: (callback) => {
        cb = callback;        
    },
    start,
    stop,
    createTenant,
    addUser,
    removeUser,
    addKeyword,
    removeKeyword
};
module.exports = tenant;