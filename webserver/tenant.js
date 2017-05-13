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
let userAddedCallback = null;
let userRemovedCallback = null;
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

const onUserAdded = (tenantKey, user) => {
    if (userAddedCallback && tenantKeys.includes(tenantKey)) {
        userAddedCallback(tenantKey, user);
    }
};

const onKeywordAdded = (tenantKey, keywordsVar) => {    
    if (keywordAddedCallback && tenantKeys.includes(tenantKey)) {        
        getKeywordsByTenantKey(tenantKey)
            .then(keywords => keywordAddedCallback(tenantKey, keywords));            
    }
};

const onKeywordRemoved = (tenantKey, keywordsVar) => {        
    if (keywordRemovedCallback && tenantKeys.includes(tenantKey)) {                
        getKeywordsByTenantKey(tenantKey)
            .then(keywords => keywordRemovedCallback(tenantKey, keywords));
    }
};

const onUserRemoved = (tenantKey, user) => {
    if (userRemovedCallback && tenantKeys.includes(tenantKey)) {
        userRemovedCallback(tenantKey, user);
    }
};

// called when a redis key expired
const expired = (redisKey) => {    
    if (/battle:tenant:\S+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:battle:tenant\:)/);
        const tenantKey = splitted[1];
        battleForTenant(tenantKey);
    }
};

// called when a redis key is set
const set = (redisKey) => {
    if (/tenant:\S+:user:\S+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenant\:|\:user\:)/);       
        const tenantKey = splitted[1];
        const user = splitted[2];
        onUserAdded(tenantKey, user);
        // is there nothing to do, when a new user is added?
    } else if (/tenant:\w+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenant:)/);
        const tenantKey = splitted[1];        
        battleForTenant(tenantKey);
    }
};

// called when a value is pushed to a list
const lpush = (redisKey) => {
    if (/tenant:\S+:keywords/.test(redisKey)) {        
        const splitted = redisKey.split(/(?:tenant\:|\:keywords)/);
        const tenantKey = splitted[1];        
        onKeywordAdded(tenantKey, redisKey);
    }    
};

// called when a value is removed from a list
const lrem = (redisKey) => {
    if (/tenant:\S+:keywords/.test(redisKey)) {                
        const splitted = redisKey.split(/(?:tenant\:|\:keywords)/);
        const tenantKey = splitted[1];        
        onKeywordRemoved(tenantKey, redisKey);        
    }
};

// called when a redis key is deleted
const del = (redisKey) => {
    if (/tenant:\S+:users:\S+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenant\:|\:users)/);
        const tenantKey = splitted[1];
        const user = splitted[2];
        onUserRemoved(tenantKey, user);
    }
};

const pmessageHandlers = {
    expired, set, lpush, lrem, del
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
    getTenantKeys().then(keys => keys.forEach(key => battleForTenant(key)));    
};

const getKey = (tenant) => {
    return tenant.consumerKey;
}

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 */
const createTenant = (tenant) => {
    const tenantKey = getKey(tenant);
    const tenantAsString = JSON.stringify(tenant);
    return client.multi()
                .lpush(`tenantKeys`, tenantKey)                
                .set(`tenant:${tenantKey}`, tenantAsString)
                .execAsync()
                .then(res => true)
                .catch(err => false);  
};

const removeTenant = (tenant) => {
    
};

const getTenantKeys = () => {
    return client.lrangeAsync(`tenantKeys`, 0, -1)
                .then(tenantKeys => new Set(tenantKeys));
};

/**
 * @param  {consumerKey, token, consumerSecret, tokenSecret} tenant
 * @param  {} user id
 */
const addUser = (tenant, user) => {
    const tenantKey = getKey(tenant);
    return client.setAsync(`tenant:${tenantKey}:users:${user}`, user)
                .then(res => true)
                .catch(err => false);
};

const removeUser = (tenant, user) => {
    const tenantKey = getKey(tenant);
    return client.multi()
                .del(`tenant:${tenantKey}:users:${user}`)
                .del(`tenant:${tenantKey}:user:${user}:keywords`)
                .execAsync()
                .then(res => true)
                .catch(err => false);
};

const addKeyword = (tenant, user, keyword) => {
    const tenantKey = getKey(tenant);
    return client.multi()
                .lpush(`tenant:${tenantKey}:user:${user}:keywords`, keyword)
                .lpush(`tenant:${tenantKey}:keywords`, keyword)
                .execAsync()
                .then(res => true)
                .catch(res => false);
};

const removeKeyword = (tenant, user, keyword) => {
    const tenantKey = getKey(tenant);
    return client.multi()
                .lrem(`tenant:${tenantKey}:user:${user}:keywords`, 0, keyword)
                .lrem(`tenant:${tenantKey}:keywords`, 1, keyword)    
                .execAsync()
                .then(res => true)
                .catch(err => false);
}

const getKeywordsByTenantKey = (tenantKey) => {
    return client.lrangeAsync(`tenant:${tenantKey}:keywords`, 0, -1)                
                 .then(keywords => new Set(keywords));
}

const getKeywordsByTenant = (tenant) => {    
    return getKeywordsByTenantKey(getKey(tenant));
};

const getUsersByTenant = (tenant) => {
    const tenantKey = getKey(tenant);
    return client.lrangeAsync(`tenant:${tenantKey}:users`, 0, 1)
                 .then(users => new Set(users));
};

const getKeywordsByUser = (tenant, user) => {
    const tenantKey = getKey(tenant);
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
    onUserAdded: (callback) => {
        userAddedCallback = callback;
    },
    onUserRemoved: (callback) => {
        userRemovedCallback = callback;
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
    getUsersByTenant,
    getKeywordsByUser,
    getTenantKeys
};
module.exports = tenant;