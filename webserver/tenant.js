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

const tenantKeys = [];

// callback when battle for tenant is won
let newTenantCallback = null;
let keywordAddedCallback = null;
let keywordRemovedCallback = null;

// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(event + '*');

const battleForTenant = (tenantKey) => {    
    client.multi()
        .incr(`battle:tenant:${tenantKey}`)
        .expire(`battle:tenant:${tenantKey}`, expirationInSeconds)        
        .execAsync()
        .then(res => {
            // get result from incr command
            const battleCounter = res[0];       
            // only one service will receive counter == 1
            if (battleCounter == 1) {
                console.log(`won battle for tenant ${tenantKey}`);
                tenantKeys.push(tenantKey);              
                if (newTenantCallback) {                    
                    client.getAsync(`tenant:${tenantKey}`)
                          .then(tenant => JSON.parse(tenant))
                          .then(tenant => newTenantCallback(tenant));                    
                }                                
            } else {
                console.log(`lost battle for tenant ${tenant}`);
            } 
        });
};

const expired = (redisVar) => {    
    if (/battle:tenant:\S+/.test(redisVar)) {
        const splitted = redisVar.split(/(?:battle:tenant\:)/);
        const tenantKey = splitted[1];
        battleForTenant(tenantKey);
    }
};

const set = (redisVar) => {
    if (/tenant:\S+:user:\S+/.test(redisVar)) {
        const splitted = redisVar.split(/(?:tenant\:|\:user\:)/);       
        const tenantKey = splitted[1];
        const user = splitted[2];
        // is there nothing to do, when a new user is added?
    } else if (/tenant:\w+/.test(redisVar)) {
        const splitted = redisVar.split(/(?:tenant:)/);
        const tenantKey = splitted[1];        
        battleForTenant(tenantKey);
    }
};

const handleKeywordAdded = (tenantKey, keywordsVar) => {    
    if (keywordAddedCallback && tenantKeys.includes(tenantKey)) {        
        client.lrangeAsync(keywordsVar, 0, -1)
            .then(keywords => keywordAddedCallback(tenantKey, keywords));            
    }
};

const lpush = (redisVar) => {
    if (/tenant:\S+:keywords/.test(redisVar)) {        
        const splitted = redisVar.split(/(?:tenant\:|\:keywords)/);
        const tenantKey = splitted[1];        
        handleKeywordAdded(tenantKey, redisVar);
    }    
};

const handleKeywordRemoved = (tenantKey, keywordsVar) => {        
    if (keywordRemovedCallback && tenantKeys.includes(tenantKey)) {        
        // tenant belongs to us
        client.lrangeAsync(keywordsVar, 0, -1)
            .then(keywords => keywordRemovedCallback(tenantKey, keywords));
    }
}

const lrem = (redisVar) => {
    if (/tenant:\S+:keywords/.test(redisVar)) {                
        const splitted = redisVar.split(/(?:tenant\:|\:keywords)/);
        const tenantKey = splitted[1];        
        handleKeywordRemoved(tenantKey, redisVar);        
    }
};

const pmessageHandlers = {
    expired, set, lpush, lrem
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
    .then(keys => keys.forEach(tenantKey => battleForTenant(tenantKey)));
};

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 */
const createTenant = (tenant) => {
    const tenantKey = tenant.consumerKey;
    return client.setAsync(`tenant:${tenantKey}`, JSON.stringify(tenant))
                .then(res => true)
                .catch(err => false);
};

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 * @param  {} user id
 */
const addUser = (tenant, user) => {
    const tenantKey = tenant.consumerKey;
    return client.setAsync(`tenant:${tenantKey}:user:${user}`, user)
                .then(res => true)
                .catch(err => false);
};

const removeUser = (tenant, user) => {
    const tenantKey = tenant.consumerKey;
    return client.multi()
                .del(`tenant:${tenantKey}:user:${user}`)
                .del(`tenant:${tenantKey}:user:${user}:keywords`)
                .execAsync()
                .then(res => true)
                .catch(err => false);
};

const addKeyword = (tenant, user, keyword) => {
    const tenantKey = tenant.consumerKey;
    return client.multi()
                .lpush(`tenant:${tenantKey}:user:${user}:keywords`, keyword)
                .lpush(`tenant:${tenantKey}:keywords`, keyword)
                .execAsync()
                .then(res => true)
                .catch(res => false);
};

const removeKeyword = (tenant, user, keyword) => {
    const tenantKey = tenant.consumerKey;
    return client.multi()
                .lrem(`tenant:${tenantKey}:user:${user}:keywords`, 0, keyword)
                .lrem(`tenant:${tenantKey}:keywords`, 1, keyword)    
                .execAsync()
                .then(res => true)
                .catch(err => false);
}

const getKeywordsByTenant = (tenant) => {
    const tenantKey = tenant.consumerKey;    
    return client.lrangeAsync(`tenant:${tenantKey}:keywords`, 0, -1)                
                 .then(keywords => new Set(keywords));
};

const getKeywordsByUser = (tenant, user) => {
    const tenantKey = tenant.consumerKey;
    return client.lrangeAsync(`tenant:${tenantKey}:user:${user}:keywords`, 0, -1)
                 .then(keywords => new Set(keywords));
};

// install job for updating battles
let interval;
const start = () => {
    interval = setInterval(() => {
        tenantKeys.forEach(tenantKey => {      
            client.expireAsync(`battle:tenant:${tenantKey}`, expirationInSeconds);
        });
    }, keepAliveInterval)
};
start();

const stop = () => {        
    tenantKeys.length = 0;
    clearInterval(interval);
};

const tenant = {
    battleForFreeTenants,        
    onNewTenant: (callback) => {
        newTenantCallback = callback;        
    },
    onKeywordAdded: (callback) => {
        keywordAddedCallback = callback;
    },
    onKeywordRemoved: (callback) => {
        keywordRemovedCallback = callback;
    },
    start,
    stop,
    createTenant,
    addUser,
    removeUser,
    addKeyword,
    removeKeyword,
    getKeywordsByTenant,
    getKeywordsByUser
};
module.exports = tenant;