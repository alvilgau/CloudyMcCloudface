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
1. To execute Node.js Lambda functions the ``lambci/lambda:build-nodejs6.10`` docker image is required.
```
docker pull lambci/lambda:nodejs6.10
```

2. Create a Lambda function by using ``lambda/helloworld.zip``:
```
aws --endpoint-url=http://localhost:4574 lambda create-function --function-name helloworld --runtime nodejs6.10 --role r1 --handler helloworld.handler --zip-file fileb://lambda/helloworld.zip
```

3. Execute the Lambda function:
```
aws --endpoint-url=http://localhost:4574 lambda invoke --function-name helloworld --payload "{}" response.log
```
If the call was successful, the following response will be shown on the commandline:
```
{
    "StatusCode": 200
}
```


 
