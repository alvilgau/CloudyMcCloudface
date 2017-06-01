require('dotenv').config();
const Hapi = require('hapi');
const AWS = require('aws-sdk');

AWS.config.update({
  region: process.env.LOG_REGION,
  endpoint: process.env.LOG_ENDPOINT
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'logs';

const server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: process.env.LOG_REST_PORT
});


const scan = (params) => new Promise((resolve, reject) => {
  docClient.scan(params, (err, data) => {
    if (err) {
      console.error(`Unable to scan table: ${JSON.stringify(err, null, 2)}`);
      reject(err);
    } else {
      resolve(data);
    }
  });
});

const query = (params) => new Promise((resolve, reject) => {
  docClient.query(params, (err, data) => {
    if (err) {
      console.error(`Unable to scan table: ${JSON.stringify(err, null, 2)}`);
      reject(err);
    } else {
      resolve(data);
    }
  });
});

server.route({
  method: 'GET',
  path:'/logs',
  handler: (request, reply) => {
    const params = {
      TableName: tableName,
      ProjectionExpression: 'service, logTimestamp, info.logMessage, info.logLevel',
    };
    return reply(scan(params));
  }
});

server.route({
  method: 'GET',
  path: '/logs/{service}',
  handler: (request, reply) => {
    const params = {
      TableName: tableName,
      KeyConditionExpression: '#service = :service',
      ExpressionAttributeNames: {
        '#service': 'service'
      },
      ExpressionAttributeValues: {
        ':service':request.params.service
      }
    };
    return reply(query(params));
  }
});

server.on('request-error', (request, err) => {
  console.error(`${err}`);
});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log(`server running at ${server.info.uri}`);
});