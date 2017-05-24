# LocalStack Guide
[LocalStack](https://www.google.com ) provides a fully functional local AWS cloud stack.

This guide describes how to setup LocalStack within a docker container and how to use the various AWS services locally.

## Precoditions
1. Docker must be installed
2. AWS CLI must be installed.

## Setup LocalStack
1. Run LocalStack in a docker container:
```
docker run --name aws-cloud -p 4567-4580:4567-4580 -p 8080:8080 atlassianlabs/localstack
```

2. Make sure that LocalStack runs correctly.

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
1. Create a Lambda function:
```
aws --endpoint-url=http://localhost:4574 lambda create-function --function-name f1 --runtime python2.7 --role r1 --handler lambda.handler --zip-file fileb://lambda/lambda.zip
```

2. Execute the Lambda function:
```
aws lambda --endpoint-url=http://localhost:4574 invoke --function-name f1 response.log
```
The response of the lambda function should be in the file ``response.log`` now.
The following response is expected:
```
{
  "foo": "bar"
}
```


 
