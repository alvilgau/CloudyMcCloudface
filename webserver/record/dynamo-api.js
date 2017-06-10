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

const insertAnalyzedTweets = (tenantId, userId, tweets) => {
    // adding timestamp to analyzed tweets
    tweets.analyzedTweets.forEach(tweet => {
        tweet.timestamp = tweets.timestamp;
    });

    console.log('Inserting analyzed tweets...');
    const params = {
        TableName: tenantId,
        Key: {
            keyword: tweets.keyword,
            userId
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


const queryTweets = (tenantId, keyword) => new Promise((resolve, reject) => {
    const params = {
        TableName: tenantId,
        KeyConditionExpression: 'keyword = :key',
        ExpressionAttributeValues: {
            ':key': keyword
        }
    };

    docClient.query(params, (err, data) => {
        if (err) {
            console.error(`Unable to scan table: ${JSON.stringify(err, null, 2)}`);
            reject(err);
        } else {
            if (data.Items.length < 1) {
                resolve('No data found');
                return;
            }

            // todo: remove score filter
            const analyzedTweets = data.Items[0].analyzedTweets;
            console.log(analyzedTweets);
            const filtered = analyzedTweets.filter(tweet => {
                return tweet.score == 0
            });
            resolve(filtered);
        }
    });
});

module.exports = {
    createTable,
    insertAnalyzedTweets,
    queryTweets
};