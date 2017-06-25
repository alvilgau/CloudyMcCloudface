require('dotenv').config();
const AWS = require('aws-sdk');
const uuidV4 = require('uuid/v4');
const Tail = require('tail').Tail;

const uuid = uuidV4();
const service = process.argv[2] || 'unknown-service';
const logLevel = process.argv[3] || 'unknown-level';
const file = process.argv[4];
const tableName = 'logs';

const tail = new Tail(file);

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

const log = (message) => new Promise ((resolve, reject) => {
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


tail.on('line', (data) => log(data));

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



