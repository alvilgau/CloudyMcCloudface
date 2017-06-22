require('dotenv').config();
const AWS = require('aws-sdk');

AWS.config.update({
    endpoint: process.env.DYNAMO_DB_ENDPOINT,
    region: process.env.DYNAMO_DB_REGION
});

const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

const createTable = (tenantId) => {
    const params = {
        TableName: tenantId,
        AttributeDefinitions: [
            {AttributeName: 'recordId', AttributeType: 'S'},
        ],
        KeySchema: [
            {AttributeName: 'recordId', KeyType: 'HASH'},  //Partition key
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

const insertAnalyzedTweets = (tenantId, recordId, tweets) => new Promise((resolve, reject) => {
    console.log('Inserting analyzed tweets for record:', recordId);

    const params = {
        TableName: tenantId,
        Key: {
            recordId,
        },
        UpdateExpression: 'set #data = list_append(if_not_exists(#data, :empty_list), :data)',
        ExpressionAttributeNames: {
            '#data': 'data'
        },
        ExpressionAttributeValues: {
            ':data': tweets,
            ':empty_list': []
        },
        ReturnValues: 'UPDATED_NEW'
    };

    docClient.update(params, function (err) {
        if (err) {
            console.error('Unable to insert analyzed tweets. Error JSON:', JSON.stringify(err, null, 2));
            reject(err);
        } else {
            console.log('Insert succeeded for record:', recordId);
            resolve();
        }
    });
});

const queryTweets = (tenantId, recordId) => new Promise((resolve, reject) => {
    const params = {
        TableName: tenantId,
        KeyConditionExpression: 'recordId = :recId',
        ExpressionAttributeValues: {
            ':recId': recordId
        }
    };

    docClient.query(params, (err, data) => {
        if (err) {
            console.error(`Unable to query table: ${JSON.stringify(err, null, 2)}`);
            reject(err);
        } else {
            resolve(data.Items);
        }
    });
});

module.exports = {
    createTable,
    insertAnalyzedTweets,
    queryTweets
};