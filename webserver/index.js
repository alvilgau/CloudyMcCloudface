
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var _ = require('lodash');
var twitterConfig = require('./twitterConfig');
var Twitter = require('node-tweet-stream')
  , t = new Twitter(twitterConfig);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

t.on('tweet', (tweet) => {
    Object.keys(subscriptions).forEach((keyword) => {        
        if (tweet.text.includes(keyword)) {            
            subscriptions[keyword].forEach((socket) => {
                socket.emit('tweet', {
                    keyword: keyword,
                    text: tweet.text                    
                });
            });
        }
    });    
});

t.on('error', (err) => {
    console.log('twitter-stream-error', err)
});

const subscriptions = {};

const subscribe = function(socket, keyword) {
    if (!subscriptions[keyword]) {        
        subscriptions[keyword] = [socket];
        t.track(keyword);        
    } else if (subscriptions[keyword].filter((s) => s === socket).length === 0) {        
        subscriptions[keyword].push(socket);
    }    
};

const unsubscribe = function(socket, keyword) {    
    if (subscriptions[keyword]) {
        subscriptions[keyword] = subscriptions[keyword].filter((s) => s !== socket);
        if (subscriptions[keyword].length === 0) {
            t.untrack(keyword);            
            subscriptions[keyword] = [];
        }
    }     
};

const removeAllSubscriptions = function(socket) {
    Object.keys(subscriptions).forEach((keyword) => {
        unsubscribe(keyword, socket);        
    });
};

io.on('connection', function (socket) {

    console.log('connection', socket.id);    

    socket.on('subscribe', function (keyword) {        
        console.log('subscribe', keyword);
        subscribe(socket, keyword);        
    });

    socket.on('unsubscribe', function(keyword) {
        console.log('unsubscribe', keyword);
        unsubscribe(socket, keyword);        
    });

    socket.on('disconnect', function () {
        console.log('disconnect', socket.id);
        removeAllSubscriptions(socket);        
    });

});

http.listen(3000, function () {
    console.log('listening on *:3000');
});