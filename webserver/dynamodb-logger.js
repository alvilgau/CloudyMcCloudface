require('dotenv').config();
const AWS = require('aws-sdk');

const service = process.argv[2] || 'unknown-service';
const verbose = process.argv.includes('-v') || process.argv.includes('--verbose');
const tableName = 'logs';

process.stdin.resume();
process.stdin.setEncoding('utf8');

AWS.config.update({
  region: process.env.LOG_REGION,
  endpoint: process.env.LOG_ENDPOINT
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const createTable = () => new Promise((resolve, reject) => {
  const params = {
    TableName : tableName,
    KeySchema: [
      { AttributeName: 'service', KeyType: 'HASH' },
      { AttributeName: 'logTimestamp', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'service', AttributeType: 'S' },
      { AttributeName: 'logTimestamp', AttributeType: 'N' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };
  dynamodb.createTable(params, (err, data) => {
    if (data || (err && err.code === 'ResourceInUseException')) {
      resolve(data);
    } else {
      reject(err);
    }
  });
});

const deleteTable = () => new Promise((resolve, reject) => {
  dynamodb.deleteTable({TableName : tableName}, (err, data) => {
    if (data || (err && err.code === 'ResourceNotFoundException')) {
      resolve(data);
    } else {
      reject(err);
    }
  });
});

const log = (logLevel, logMessage) => new Promise ((resolve, reject) => {
  const logEntry = {
    TableName: tableName,
    Item: {
      service,
      logTimestamp: new Date().getUTCDate(),
      info: {
        logMessage,
        logLevel
      }
    }
  };
  docClient.put(logEntry, (err, data) => {
    if (data) {
      resolve(data);
    } else {
      reject(err);
    }
  });
});

const handleChunk = (chunk, logLevel) => {
  const lines = chunk.split('\n');
  lines.filter(line => line.length !== 0)
    .forEach(line => {
      log(logLevel, line)
        .then(ok => verbose && console.log(`[${logLevel} - ${service}] ${line}`))
        .catch(err => console.error(`could not log ${logLevel} message [${service}] ${line}`));
    });
};

process.stdin.on('data', (chunk) => handleChunk(chunk, 'info'));
process.stderr.on('data', (chunk) => handleChunk(chunk, 'error'));


createTable()
  .then(ok => log('info', 'mymessage'))
  .then(console.log)
  .catch(console.error);