require('dotenv').config();
const Hapi = require('hapi');
const AWS = require('aws-sdk');

const server = new Hapi.Server();
server.connection({
    host: 'localhost',
    port: 3010
});

// Add the route
server.route({
    method: 'GET',
    path: '/tweets',
    handler: function (request, reply) {
        return reply('Here the tweets will be shown soon...');
    }
});

// Start the server
server.start((err) => {
    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});
