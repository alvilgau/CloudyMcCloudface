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
    AttributeDefinitions: [
      { AttributeName: 'service', AttributeType: 'S' },
      { AttributeName: 'level', AttributeType: 'S' }/*,
      { AttributeName: 'message', AttributeType: 'S' }*/
    ],
    KeySchema: [
      { AttributeName: 'service', KeyType: 'HASH' },
      { AttributeName: 'level', KeyType: 'RANGE' }/*,
      { AttributeName: 'message', KeyType: 'RANGE' }*/
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10,
      WriteCapacityUnits: 10
    }
  };
  dynamodb.createTable(params, (err, data) => {
    if (err) reject(err);
    else     resolve(data);
  });
});

const deleteTable = () => new Promise((resolve, reject) => {
  dynamodb.deleteTable({TableName : tableName}, (err, data) => {
    if (err) reject(err);
    else     resolve(data);
  });
});

const log = (level, message) => new Promise ((resolve, reject) => {
  const logData = {
    TableName: tableName,
    Item: { service, level/*, message */}
  };
  docClient.put(logData, (err, data) => {
    if (err) reject(err);
    else     resolve(data);
  });
});

const handleChunk = (chunk, level) => {
  const lines = chunk.split('\n');
  lines.filter(line => line.length !== 0)
    .forEach(line => {
      log(service, level, line)
        .then(verbose && console.log(`[${level} - ${service}] ${line}`))
        .catch(err => console.error(`could not log ${level} message [${service}] ${line}`));
    });
};

process.stdin.on('data', (chunk) => handleChunk(chunk, 'info'));
process.stderr.on('data', (chunk) => handleChunk(chunk, 'error'));


deleteTable()
  .then(ok => createTable())
  .then(ok => log(service, 'info', 'hello out there'))
  .catch(console.error);