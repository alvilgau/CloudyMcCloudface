require('dotenv').config();
const Hapi = require('hapi');
const dynamo = require('./dynamo-api');

const server = new Hapi.Server();
server.connection({
    host: 'localhost',
    port: 3010
});

server.route({
    method: 'GET',
    path: '/tweets/{tenantId}/{keyword}',
    handler: function (request, reply) {
        return reply(dynamo.queryTweets(request.params.tenantId, request.params.keyword,
            request.query.begin, request.query.end));
    }
});

server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});
