require('dotenv').config();
const AWS = require('aws-sdk');
const uuidV4 = require('uuid/v4');

const uuid = uuidV4();
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
  const timestamp = new Date().getTime();
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

const handleChunk = (chunk) => {     
  const match = chunk.match(/^\[(.*)\]/);
  const data = {
        message: chunk.replace(match && match[0] + ' ', ''),
        logLevel: match && match[1]
    };
  data.logLevel && log(data.logLevel, data.message);
};

process.stdin.on('data', (chunk) => handleChunk(chunk));

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



