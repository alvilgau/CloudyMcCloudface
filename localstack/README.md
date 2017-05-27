# LocalStack Guide
[LocalStack](https://github.com/atlassian/localstack) provides a fully functional local AWS cloud stack.

This guide describes how to setup LocalStack within a docker container and how to use the various AWS services locally.

## Preconditions
1. Docker must be installed.
2. AWS CLI must be installed.

## Setup LocalStack
1. Get LocalStack from github:
```
git clone https://github.com/atlassian/localstack.git
```

2. Run LocalStack using docker-compose:
```
docker-compose up
```

2.1 Configure aws:
```
aws configure
```

- set `AWS Access Key ID` to `a`
- set `AWS Secret Access Key` to `a`
- set `Default region name` to `a`
- set `Default output format` to `json`

3. Make sure that LocalStack runs correctly.
The following command:
```
aws --endpoint-url=http://localhost:4574 lambda list-functions 
```
should return:
```
{
    "Functions": []
}
```

## Lambda Functions
### Setup & Test
1. To execute Node.js Lambda functions the ``lambci/lambda:build-nodejs6.10`` docker image is required.
```
docker pull lambci/lambda:nodejs6.10
```

2. Create a Lambda function by using ``lambda/sum.zip``:
```
aws --endpoint-url=http://localhost:4574 lambda create-function --function-name sum --runtime nodejs6.10 --role r1 --handler sum.handler --zip-file fileb://lambda/sum.zip
```

3. Execute the Lambda function:
```
aws --endpoint-url=http://localhost:4574 lambda invoke --function-name sum --payload '{""val1"":5, ""val2"":3}' response.log
```
If the call was successful, the following response will be shown on the commandline:
```
{
    "StatusCode": 200
}
```
The sum of the two entered entered values will be in the ``response.log``.

### Invoke with Node.js
To execute the Lambda function with Node.js:
1. Enter ``lambda_invoke``
2. Run ``npm install`` and ``node invoke.js``