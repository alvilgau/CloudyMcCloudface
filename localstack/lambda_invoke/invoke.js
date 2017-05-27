'use strict';

const AWS = require('aws-sdk');

AWS.config.update({
    // accessKeyId: '...',
    // secretAccessKey: '...',
    endpoint: 'http://localhost:4574',
    region: 'eu-central-1'
});

const lambda = new AWS.Lambda();

const payload = {val1: 4, val2: 2};
const params = {
    FunctionName: 'sum',
    Payload: JSON.stringify(payload)
};

lambda.invoke(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else     console.log(data);           // successful response
});