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

// subscribe for all events
const event = `__keyevent@${db}__:`;
subscriber.psubscribe(event + '*');

const handleNewTenant = null;

const battleForTenant = (tenant) => {
    client.incrAsync(`battle:tenant:${tenant}`)
        .then(battleCounter => {
            // only one service will receive counter == 1
            if (battleCounter == 1) {
                console.log(`won battle for tenant ${tenant}`);
                tenants.push(tenant);
                if (handleNewTenant) {
                    handleNewTenant(tenant);
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

const pmessageHandlers = {
    expired
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
    'newTenant': battleForTenant
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

// install job for updating battles
setInterval(() => {
    tenants.forEach(tenant => {      
        client.expireAsync(`battle:tenant:${tenant}`, expirationInSeconds);
    });
}, keepAliveInterval);

const tenant = {
    battleForFreeTenants,    
    onNewTenant: (callback) => {
        handleNewTenant = callback;        
    }
};
module.exports = tenant;