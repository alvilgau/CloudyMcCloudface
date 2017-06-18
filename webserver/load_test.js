const WebSocket = require('ws');

const numOfSockets = process.argv[2] || 500;
const sockets = [];
const url = '';

const keywords = ['trump', 'obama', 'twitter', 'london', 'apple', 'beer', 'dog', 'cat', 'life', 'party', 'sunday', 'monday', 'work', 'train', 'sf', 'drink', 'hangover'];

const getFiveRandomKeywords = () => {
  const kw = [];
  for (let i = 0; i < 5; i++) {
    const item = keywords[Math.floor(Math.random()*keywords.length)];
    kw.push(item);
  }
  return kw;
};

const createWebSocketConnection = () => {

  const ws = new WebSocket(url);
  const keywordsToTrack = getFiveRandomKeywords();
  ws.on('open', () => {
    console.log('opened connection');
    ws.send(JSON.stringify({
      tenant: null,
      keywords: keywordsToTrack
    }));
  });
  ws.on('error', console.error);

  ws.on('message', (data) => {
    console.log(data);
  });

  sockets.push(ws);
};

// create one connection
createWebSocketConnection();

// wait 2 seconds, then open a lot of other connections
setTimeout(() => {
  for (let i = 0; i < numOfSockets - 1; i++) {
    createWebSocketConnection();
  }
}, 2000);

setTimeout(() => {
  sockets.forEach(socket => {
    socket.close()
  });
}, 120000);
