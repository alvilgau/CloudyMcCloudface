require('dotenv').config();
const Path = require('Path');
const Hapi = require('hapi');
const AWS = require('aws-sdk');
const _ = require('lodash');

AWS.config.update({
  region: process.env.LOG_REGION,
  endpoint: process.env.LOG_ENDPOINT
});

const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = 'logs';

const server = new Hapi.Server({
  connections: {
    routes: {
      files: {
        relativeTo: Path.join(__dirname, '../web/log')
      }
    }
  }
});
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
      TableName: tableName
    };
    return reply(scan(params));
  }
});

server.route({
  method: 'GET',
  path: '/services',
  handler: (request, reply) => {
    const params = {
      TableName: tableName,
      ProjectionExpression: 'service'
    };
    const services = scan(params)
      .then(res => res.Items)
      .then(items => items.map(item => item.service))
      .then(_.uniq);
    return reply(services);
  }
});

server.route({
  method: 'GET',
  path: '/services/{service}/logs',
  handler: (request, reply) => {
    const params = {
      TableName: tableName,
      FilterExpression: '#service = :service',
      ExpressionAttributeNames: {
        '#service': 'service'        
      },
      ExpressionAttributeValues: {
        ':service': request.params.service
      }
    };
    console.log(params);
    return reply(scan(params));
  }
});

server.register(require('inert'), (err) => {
  if (err) {
    throw err;
  }

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, reply) => {
      reply.file('log.html');
    }
  });

});

server.start((err) => {
  if (err) {
    throw err;
  }
  console.log(`server running at ${server.info.uri}`);
});