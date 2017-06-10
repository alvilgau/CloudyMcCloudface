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
        ],
        KeySchema: [
            {AttributeName: 'keyword', KeyType: 'HASH'},  //Partition key
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
    // adding timestamp to analyzed tweets
    tweets.analyzedTweets.forEach(tweet => {
        tweet.timestamp = tweets.timestamp;
    });

    console.log('Inserting analyzed tweets...');
    const params = {
        TableName: tenantId,
        Key: {
            keyword: tweets.keyword,
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

            let analyzedTweets = data.Items[0].analyzedTweets;

            // filter by timestamp
            const from = begin || new Date(2017, 1, 1).getTime();
            const until = end || new Date().getTime();
            analyzedTweets = analyzedTweets.filter(tweet => {
                return tweet.timestamp >= from && tweet.timestamp <= until;
            });

            resolve(analyzedTweets);
        }
    });
});

module.exports = {
    createTable,
    insertAnalyzedTweets,
    queryTweets
};