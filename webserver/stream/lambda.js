require('dotenv').config();
const fs = require('fs');
const aws = require('aws-sdk');
const admZip = require('adm-zip');
const lambdaMain = require('../../lambda/main');


// test with console:
// create
// aws --endpoint-url=http://192.168.99.100:4574 lambda create-function --function-name analyzeTweets --runtime nodejs6.10 --role r1 --handler main.handler --zip-file fileb://../lambda/lambda.zip
// delete
// aws --endpoint-url=http://192.168.99.100:4574 lambda delete-function --function-name analyzeTweets
// call
// aws --endpoint-url=http://192.168.99.100:4574 lambda invoke --function-name analyzeTweets --payload '{"tweets": ["i hate you", "i love you"]}' response.log

aws.config.update({
  endpoint: process.env.LAMBDA_ENDPOINT,
  region: process.env.LAMBDA_REGION
});

const lambda = new aws.Lambda();

const deleteLambdaFunction = () => new Promise((resolve) => {
  const params = {
    FunctionName: 'analyzeTweets'
  };
  lambda.deleteFunction(params, (err, data) => resolve({}));
});

const createLambdaFunction = () => new Promise((resolve, reject) => {

  const zip = new admZip();
  zip.addLocalFile('../lambda/main.js');
  zip.addLocalFolder('../lambda/node_modules');
  const buffer = zip.toBuffer();

  const params = {
    Code: {
      ZipFile: buffer
    },
    Description: "Lambda function to analyze tweets",
    FunctionName: 'analyzeTweets',
    Handler: "main.handler",
    Runtime: "nodejs6.10",
    Role: process.env.LAMBDA_ROLE
  };
  lambda.createFunction(params, (err, data) => {
    if (err) reject(err);
    else     resolve(data);
  });
});

const analyzeTweets = (tweets) => new Promise((resolve, reject) => {

  if (!process.env.AWS) {
    resolve(lambdaMain.analyzeTweets(tweets));
  } else {
    const params = {
        FunctionName: 'analyzeTweets',
        Payload: JSON.stringify({tweets})
      };
      lambda.invoke(params, (err, data) => {
        if (err) reject(err);
        else     resolve(data.Payload);
      });      
  }
});

module.exports = {
  deleteLambdaFunction,
  createLambdaFunction,
  analyzeTweets
};
