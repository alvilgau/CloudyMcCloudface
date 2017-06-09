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
            {AttributeName: 'keyword', AttributeType: 'S'},
            {AttributeName: 'userId', AttributeType: 'S'}
        ],
        KeySchema: [
            {AttributeName: 'keyword', KeyType: 'HASH'},  //Partition key
            {AttributeName: 'userId', KeyType: 'RANGE'}  //Sort key
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

const insertAnalyzedTweets = (tenantId, userId, keyword, analyzedTweets) => {
    console.log('Inserting analyzed tweets...');
    const params = {
        TableName: tenantId,
        Key: {
            keyword: keyword,
            userId: userId
        },
        UpdateExpression: 'set analyzedTweets = list_append(if_not_exists(analyzedTweets, :empty_list), :tweets)',
        ExpressionAttributeValues: {
            ':tweets': analyzedTweets,
            ':empty_list': []
        },
        ReturnValues: 'UPDATED_NEW'
    };

    docClient.update(params, function (err) {
        if (err) {
            console.error('Unable to insert analyzed tweets. Error JSON:', JSON.stringify(err, null, 2));
        } else {
            console.log('Insert succeeded.');
        }
    });
};

module.exports = {
    createTable,
    insertAnalyzedTweets
};