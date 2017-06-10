require('dotenv').config();
const AWS = require('aws-sdk');
const uuidV4 = require('uuid/v4');

AWS.config.update({
    // endpoint: process.env.DYNAMO_DB_ENDPOINT,
    region: process.env.DYNAMO_DB_REGION
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = 'records';

const createTable = () => {
    const params = {
        TableName: tableName,
        AttributeDefinitions: [
            {AttributeName: 'id', AttributeType: 'S'},
        ],
        KeySchema: [
            {AttributeName: 'id', KeyType: 'HASH'}
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    dynamodb.createTable(params, function (err, data) {
        if (data) {
            console.log('Created table. Table description JSON:', JSON.stringify(data, null, 2));
        } else if (err && err.code !== 'ResourceInUseException') {
            console.error('Could not create table. Error JSON:', JSON.stringify(err, null, 2));
            process.exit(1);
        }
    });
};

const insertRecord = (record) => new Promise((resolve, reject) => {
    record.id = uuidV4();
    const params = {
        TableName: tableName,
        Item: record
    };

    docClient.put(params, function (err, data) {
        if (err) {
            console.error('Unable to insert record. Error JSON:', JSON.stringify(err, null, 2));
            reject(err);
        } else {
            resolve(record);
        }
    });
});


module.exports = {
    createTable,
    insertRecord
};