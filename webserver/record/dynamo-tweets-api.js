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
            {AttributeName: 'keyword', AttributeType: 'N'},
        ],
        KeySchema: [
            {AttributeName: 'recordId', KeyType: 'HASH'},  //Partition key
            {AttributeName: 'keyword', KeyType: 'RANGE'},  //Range key
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

const insertAnalyzedTweets = (tenantId, tweets) => {
    console.log('Inserting analyzed tweets...');
    const params = {
        TableName: tenantId,
        Key: {
            keyword: tweets.keyword,
            timestamp: tweets.timestamp
        },
        UpdateExpression: 'set analyzedTweets = list_append(if_not_exists(analyzedTweets, :empty_list), :tweets)',
        ExpressionAttributeValues: {
            ':tweets': tweets.analyzedTweets,
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


const queryTweets = (tenantId, keyword, begin, end) => new Promise((resolve, reject) => {
    const params = {
        TableName: tenantId,
        KeyConditionExpression: '#keyword = :key and #timestamp between :begin and :end',
        ExpressionAttributeNames: {
            '#keyword': 'keyword',
            '#timestamp': 'timestamp'
        },
        ExpressionAttributeValues: {
            ':key': keyword,
            ':begin': parseInt(begin) || new Date(2017, 1, 1).getTime(),
            ':end': parseInt(end) || new Date().getTime()
        }
    };

    docClient.query(params, (err, data) => {
        if (err) {
            console.error(`Unable to query table: ${JSON.stringify(err, null, 2)}`);
            reject(err);
        } else {
            resolve(data);
        }
    });
});

module.exports = {
    createTable,
    insertAnalyzedTweets,
    queryTweets
};