const redis = require('redis');
const bluebird = require('bluebird');
const pubsubutil = require('./pubsubutil');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

const client = redis.createClient(); 
const subscriber = redis.createClient();

// todo: read from env
const db = 0;
const expiration = 3;
const keepAliveInterval = ((expiration-1) * 1000) / 2;

// enable keyspace events
subscriber.config('set', 'notify-keyspace-events', 'KEA');

// callback when battle for tenant is won
let newTenantCallback = (tenant) => {};
let userAddedCallback = (tenantId, userId) => {};
let userRemovedCallback = (tenantId, userId) => {};
let keywordAddedCallback = (tenantId, userId, keyword) => {};
let keywordRemovedCallback = (tenantId, userId, keyword) => {};

// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(event + '*');

const battleForTenant = (tenantId) => {    
    client.multi()
        .incr(`battle:tenants->${tenantId}`)
        .expire(`battle:tenants->${tenantId}`, expiration)        
        .execAsync()
        .then(res => {
            // get result from incr command
            const battleCounter = res[0];       
            // only one service will receive counter == 1
            if (battleCounter == 1) {
                console.log(`won battle for tenant ${tenantId}`);                
                client.getAsync(`tenants->${tenantId}`)
                        .then(tenant => JSON.parse(tenant))
                        .then(tenant => {     
                            pubsubutil.addTenant(tenant);
                            newTenantCallback && newTenantCallback(tenant);                               
                        });                                      
            } else {
                console.log(`lost battle for tenant ${tenant}`);
            } 
        });
};

// called when a redis key expired
const expired = (redisKey) => {  
    if (/battle:tenants->\S+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:battle:tenant\:)/);
        const tenandId = splitted[1];
        battleForTenant(tenandId);
    }
};

// called when a redis key is set
const set = (redisKey) => {
    if (/tenants->\S+/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenants->)/);
        const tenandId = splitted[1];
        battleForTenant(tenandId);
    }
};

const handlePushKeywords = (tenantId, userId) => {    
    client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
          .then(keywords => {
                const t = pubsubutil.getTenant(tenantId);
                keywords.forEach(keyword => {                    
                    pubsubutil.addKeyword(t, userId, keyword);                    
                })                
           });                             
};

const handlePushUser = (tenantId) => {    
    client.lrangeAsync(`tenants:${tenantId}->users`, 0, -1)
        .then(userIds => {
            const knownUserIds = pubsubutil.getUserIds(tenantId);
            userIds.forEach(userId => {
                if (!knownUserIds.includes(userId)) {
                    pubsubutil.addUser(tenantId, userId);
                    userAddedCallback && userAddedCallback(tenantId, userId);                    
                }
            });
        });
};  

// called when a value is pushed to a list
const lpush = (redisKey) => {
    if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
        const tenantId = splitted[1];
        const user = splitted[2];
        handlePushKeywords(tenantId, user);
    }
    else if (/tenants:\S+->users/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenants\:|->users)/);
        const tenantId = splitted[1];
        handlePushUser(tenantId);
    }     
};

const handleRemoveKeywords = (tenantId, userId) => {
    
    client.lrangeAsync(`tenants:${tenantId}:users:${userId}->keywords`, 0, -1)
        .then(keywords => {                    
            u.keywords.forEach(kw => {
                if (!keywords.includes(kw)) {
                    u.keywords.delete(kw);
                    if (keywordRemovedCallback) {
                        keywordRemovedCallback(tenantId, userId, kw);
                    }
                }
            });
        });     
};

const handleRemoveUser = (tenantId) => {
    const t = tenants.find(t => getId(t) === tenantId);
    if (t && t.users) {
        client.lrangeAsync(`tenants:${tenantKey}->users`, 0, -1)
            .then(userIds => {
                t.users.forEach(u => {
                    if (!userIds.includes(u.id)) {
                        const index = t.users.indexOf(u);
                        t.users.splice(index, 1);                        
                        if (keywordRemovedCallback) {
                            u.keywords.forEach(kw => {
                                keywordRemovedCallback(tenantId, u, kw);
                            });
                        }
                    }
                });
            });
    }
};

// called when a value is removed from a list
const lrem = (redisKey) => {
    if (/tenants:\S+:users:\S+->keywords/.test(redisKey)) {                
        const splitted = redisKey.split(/(?:tenants\:|\:users\:|->keywords)/);
        const tenantId = splitted[1];        
        const userId = splitted[2];        
        handleRemoveKeywords(tenantId, userId);
    }
    else if (/tenants:\S+->users/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenants\:|->users)/);
        const tenantId = splitted[1];
        handleRemoveUser(tenantId);
    }
};

// called when a redis key is deleted
const del = (redisKey) => {
    if (/tenant:\S+:users:\S+->keywords/.test(redisKey)) {
        const splitted = redisKey.split(/(?:tenant\:|\:users\:|->keywords)/);
        const tenantId = splitted[1];
        const userId = splitted[2];        
        handleRemoveKeywords(tenantId, userId);
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
    redisGetTenantIds().then(ids => ids.forEach(id => battleForTenant(id)));    
};

const redisGetTenantIds = () => {
    return client.scanAsync(0, 'MATCH', 'tenants->*')
                .then(res => {
                    const redisKeys = res[1];
                    const tenantIds = new Set();
                    redisKeys.forEach(key => {
                        const tenantId = key.replace('tenants->', '');
                        tenantIds.add(tenantId);
                    });
                    return tenantIds;
                })
                .catch(err => {
                    console.error('could not query tenant ids from redis');
                    return new Set();
                });                              
};

// install job for updating battles
setInterval(() => {
    tenants.forEach(tenant => {      
        const tenantId = getId(tenant);
        client.expireAsync(`battle:tenants->${tenantId}`, expiration);
    });
}, keepAliveInterval);


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
    }
};
module.exports = tenant;