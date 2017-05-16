const publisher = require('./publisher');

 const t = {
    consumerKey: 'my-consumerKey',
    token: 'my-token',
    consumerSecret: 'my-consumerSecret',
    tokenSecret: 'my-tokenSecret'        
};

publisher.trackKeyword(t, 'user1', 'obama');
publisher.trackKeyword(t, 'user2', 'clinton');
publisher.trackKeyword(t, 'user3', 'trump');