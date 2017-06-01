require('dotenv').config();
const AWS = require('aws-sdk');
const uuidV1 = require('uuid/v1'); // uuid1 is time based

const uuid = uuidV1();
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
      { AttributeName: 'logLevel', AttributeType: 'S' }
    ],
    KeySchema: [
      { AttributeName: 'service', KeyType: 'HASH' },
      { AttributeName: 'logLevel', KeyType: 'RANGE' }
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

const log = (logLevel, message) => new Promise ((resolve, reject) => {
  const timestamp = new Date().toISOString();
  const params = {
    TableName: tableName,
    Key: {
      service,
      logLevel,
    },
    UpdateExpression: 'set logs = list_append(if_not_exists(logs, :empty_list), :log)',
    ExpressionAttributeValues: {
      ':log': [{ uuid, timestamp, message }],
      ':empty_list': []
    },
    ReturnValues: 'UPDATED_NEW'
  };
  docClient.update(params, (err, data) => {
    if (err) reject(err);
    else     resolve(data);
  });
});

const handleChunk = (chunk, logLevel) => {
  const lines = chunk.split('\n');
  lines.filter(line => line.length !== 0)
    .forEach(line => {
      log(logLevel, line)
        .then(ok => verbose && console.log(`[${logLevel} - ${service}] ${line}`))
        .catch(err => console.error(`could not log ${logLevel} message [${service}] ${line} -> ${err}`));
    });
};

process.stdin.on('data', (chunk) => handleChunk(chunk, 'info'));
process.stderr.on('data', (chunk) => handleChunk(chunk, 'error'));

if (process.argv.includes('delete')) {
  deleteTable()
    .then(console.log)
    .catch(console.error);
}
if (process.argv.includes('create')) {
  createTable()
    .then(console.log)
    .catch(console.error);
}



