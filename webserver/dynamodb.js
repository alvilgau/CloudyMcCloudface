const AWS = require("aws-sdk");
const redisEvents = require('./redis_events');

AWS.config.update({
    region: "eu-central-1",
    endpoint: "http://localhost:4569"
});

const dynamodb = new AWS.DynamoDB();

/**
 * Create a table in aws dynamodb
 * @param tableName shoud be the id of an tenant
 */
const createTable = (tableName) => {
    const params = {
        TableName: tableName,
        AttributeDefinitions: [
            {AttributeName: "keyword", AttributeType: "S"},
            {AttributeName: "userId", AttributeType: "S"}
        ],
        KeySchema: [
            {AttributeName: "keyword", KeyType: "HASH"},  //Partition key
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    dynamodb.createTable(params, function (err, data) {
        if (err) {
            if (err.code === "ResourceInUseException") {
                console.log("Table already created.")
            }
            else {
                console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
            }
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });
};


//
// const docClient = new AWS.DynamoDB.DocumentClient();
//
// const doc = {
//     TableName: "Movies",
//     Item: {
//         "year": 2016,
//         "title": "Hello world",
//         "info": "First film"
//     }
// };
//
// docClient.put(doc, function (err, data) {
//     if (err) {
//         console.error("Unable to add movie. Error JSON:", JSON.stringify(err, null, 2));
//     } else {
//         console.log("PutItem succeeded:");
//     }
// });

redisEvents.on('keywordAdded', (tenantId, userId) => {
    redisEvents.subscribe(tenantId, userId, (tenantId, userId, analyzedTweets) => {
        console.log(analyzedTweets.tweets[0]);
    });
});

/*
 redisEvents.on('keywordRemoved', (tenantId, userId) => {
 console.log("dynamo: keyword removed");
 });

 redisEvents.on('userRemoved', (tenantId, userId) => {
 console.log("dynamo: remove user");
 });
 */