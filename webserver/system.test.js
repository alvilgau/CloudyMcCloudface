require('dotenv').config();
const WebSocket = require('ws');

jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000; // 20 seconds should be enough otherwise test will fail

test('system', (done) => {

  if(process.env.TRAVIS) {
    doNotRunSystemTest(done);
  } else {
    runSystemTest(done);
  }

});

const doNotRunSystemTest = (done) => {
  expect(true).toBeTruthy();
  done();
};

const runSystemTest = (done) => {
  const ws = new WebSocket('ws://::3000');
  ws.on('open', () => {
    ws.send(JSON.stringify({
      tenant: null,
      keywords: ['trump', 'obama', 'clinton']
    }));
  });
  ws.on('message', (data) => {
    // we received some data -> test passed
    ws.close();
    expect(true).toBeTruthy();
    done();
  });
};