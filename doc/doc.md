Twitter Sentiment Analysis

*from Alexander Vilgauk, Andreas Sayn and Markus Heilig* 

# Introduction

Twitter Sentiment Analysis *TSA* is a cloud ready multi tenancy twitter analysis application. *TSA* enables users to analyse the sentiment of tweets on any desired subject.
The gathered data is plotted in a web application in real time. Besides real time analysis *TSA* also allows scheduling an analysis for a specific time frame. This analyzed data can be accessed any time.

In order to handle a any amount of tweets and clients concurrently, *TSA* needs to be highly scalable and is therefore a perfect fit for "The Cloud".

# Application Design

The *TSA* back end is realized with Node.js-micro services written in JavaScript.

These services are:

- *webserver-service*:
    
    The webserver serves the client application file (index.html), exposes a REST API for recording analyzed tweets for given keywords and also exposes an websocket endpoint.
    
- *tweetstream-service*:

    The *tweetstream-service* subscribes to the Twitter Streaming API to receive tweets in real-time. These tweets are then published to the tweet analyzer.
    
- *tweetanalyzer-service*:

    The *tweetanalyzer* is an AWS Lambda function which computes statistical parameters for a bunch of tweets based on the sentiment of the tweets' content.
    
- *recorder-service*:
    
    The recorder service persists the analyzed tweets for scheduled analysis.
          
- *log-service*:

    The log services is a simple Node.js application which receives console outputs from other services via operating system pipes. These messages are then stored in an AWS DynamoDB. 

The following graphic gives an overview of the application in the AWS cloud. Logging relevant services were omitted for more clarity.

![AWS Setup](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/aws-setup.png "AWS Setup")

    
The *TSA* front end is written in Elm, a functional programming language which compiles to Javascript. The client application connect to the server via web sockets in order to receive statistics for the desired keywords.

![Elm UI](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/ui.png "Elm web app")

## Overall design and data stores

### Inter-process communication

When a new user launches the app and enters the keywords he or she wants to track, the client sends a JSON encoded message to the websocket server with the specified keywords and optionally some tenant information.
After the server receives such a message, the following information will be tracked in redis:
- tenant information if specified, i.e. twitter o-auth credentials
- user information, represented as uuid
- keywords the user wants to track
This means that the redis cache stores the information about which user belongs to which tenant and which keywords each user wants to track. The *TSA* application provides a 'default tenant' for all users which have not specified a tenant.

When redis variables, also called *keys*, are set, changed, deleted or expire, redis publishes so called keyspace events which can be subscribed to from other services to receive app specific notifications. *TSA* uses these events in the *tweetstream-service* to get notified when a user wants to track keywords. In this case, the *tweetstream-service* can create a new stream connection to the Twitter Streaming API.

### Tweet analysis

Shortly after the *tweetstream-service* created a streaming connection to the Twitter API, the service will receive tweets based on the specified keywords. Tweets are JSON objects that include the tweet text with emojis, the time when the tweet was created, how many times a tweet was retweeted, geolocation information and much more. Right now, only the tweet text including the emojis is used for sentiment analysis and thus will be extracted from the tweet JSON object and stored temporarily in memory. 
A periodic timer in the *tweetstream-service* triggers the service to send all temporarily stored tweets to *tweetanalyzer-service*, an AWS Lambda function. 
This AWS Lambda function takes an array of strings as input parameter and returns a json object containing the following statistical parameters about the tweets' sentiment:

    - mean
    - variance
    - standard deviation
    - 0.25 quartile
    - 0.50 quartile (i.e. median)
    - 0.75 quartile

The sentiment analysis is realized with a Node.js module called [sentiment](https://github.com/thisandagain/sentiment) which is based on the AFINN-165 word list as well as Emoji Sentiment Ranking to perform the analysis.

After the calculation is done and the *tweetstream-service* receives the analysis, it publishes the results through redis channels on which other services can subscribe to. This way, the *webserver-service* is able to subscribe to analyzed tweets and send the results back to the client applications via websocket messages; the *recorder service* is able to subscribe in order to store the analyzed tweets results.

### Tweet recording
Through a REST-API which is included in the webserver, the user has the possibility to record analyzed tweets for a certain period of time. All necessary data for recording will be persisted in a DynamoDB. The start and end time for the record will be cached in Redis. When one of this cached keys expires, Redis sends a notification to the recorder service. Through this notifications the recorder service knows when it has to start or stop recording. During the recording the analyzed tweets will be persisted in a DynamoDB so that the user can access them later. For each tenant the analyzed tweets will be persisted in a separate table. To minimize the write throughput, the analyzed tweets will be cached first for 20 seconds and then persisted.

## Implementation of the functionality


## External cloud resource types

## Scaling

There are four different kinds of scaling scenarios for *TSA*.

1. Scale for tenants

When the number of tenant increases, then there will be more http-connections to the Twitter Streaming API (which is one per tenant). In order to handle a massive amount of streams concurrently, multiple instances of the *tweetstream-service* may be required. For this purpose an auto scaling group was created for the *tweetstream-service*. This auto scaling group is configured as follow:

- Start a new *tweetstream-service* instance when the average incoming network traffic is greater than 85 Megabyte for two minutes.
- Stop a *tweetstream-service* instance when the average incoming network traffic is less than 30 Megabyte for 10 minutes.
- Every 30 seconds a health check will be executed to exchange dead instances. 

2. Scale for users

When the number of user increases, then there are a lot of websocket connections to handle, one for each user. In order to handle a huge amount of users, new instances of the *webserver-service* need to be started. For this purpose a auto scaling group and a elastic load balancer was created. The auto scaling group has the following scaling policies:

- Start a new *webserver-service* instance when the average outgoing network traffic is greater than 85 Megabyte for two minutes.
- Stop a *webserver-service* instance when the average outgoing network traffic is less than 30 Megabyte for 10 minutes.
- To exchange dead instances, the health check of the elastic load balancer will be used.

The elastic load balancer distributes all incoming HTTP requests and incoming websocket connections evenly to distribute the load on the *webserver-service* instances.

3. Scale for tweets

When there are a lot of tweets which have to be analyzed, there is nothing further to do! The analyzer function is a stateless AWS Lambda function which is scaled automatically by Amazon.

4. Scale for records

When the number of records increases, there will be a lot of analyzed tweets that must be handled. For this reason an auto scaling group for the *recorder-service* was created too. This auto scaling group is configured exactly like the auto scaling group of *tweetstream-service*. Only the health check period is set to 5 minutes.

## Multi-Tenancy

This section describes the multi-tenancy support provided by *TSA*.

### Definition of user
A user is defined as a consumer of our service, e.g. someone who uses the *TSA* Elm-client.
From the technical point of view, a user is represented by a websocket connection. When a new websocket is established by a user, a unique token is generated and used as the identification of the user. Consequently the user can only be uniquely identified for the duration of the websocket session. The unique token is also used to assign the desired keywords to the user. This allows determining which analyzed tweets need to be send to which user respectively websocket.

### Definition of tenant
To make a connection to the Twitter Streaming API, OAuth access tokens are required. These can be obtained by creating a twitter application and are used by Twitter for the purpose of authentication. *TSA* has multi-tenancy support built-in. In the context of *TSA* a tenant is defined as a twitter application. When a twitter application is registered, Twitter generates four significant values which are required to access the twitter api:

 - Consumer Key (API Key)

 - Consumer Secret (API Secret)

 - Access Token

 - Access Token Secret

This enables a user or a group of users to use their own twitter credentials when analyzing tweets with *TSA*. If multiple users share the same credentials to use *TSA*, they will be seen as 'one tenant' belonging to one organization from *TSA*s point of view.

*TSA* has also provides a default tenant which is shared by all users who don't want to register a twitter application themselves.


## 12 factors

*TSA* is build around the twelve-factor methodology in order to fulfill the requirements for a software-as-a-service application. The steps performed will be described in the following subsections.

### I. Codebase

The source code for the project is tracked in a public Git repository on [GitHub](https://github.com/cloudy-sentiment-analysis/CloudyMcCloudface). This repository contains the whole application (backend-services as well as frontend-client) and thus can easily be used for deployments on different systems (e.g. for production-deployment on AWS or local deployment for development reasons running with [localstack](https://github.com/atlassian/localstack)).

Note: 
The configuration file for the production *TSA-services* is tracked in a separate private Git repository on [GitHub] due to security issues like private o-auth-credentials.

### II. Dependencies

To manage their dependencies, the Node.js-services use the node package manager `npm` which is shipped with a common Node.js-installation. The dependencies are declared in a configuration file called `package.json` and can easily be installed running the following console command, so there is no need to store external modules in the repository itself:

```bash
npm install
```

The same applies to the Elm dependencies. The only difference is that the configuration file is called `elm-package.json` and the tool to manage the dependencies is called `elm-package`.

### III. Config

The services receive their configuration during startup by processing a file called `.env`. This file defines the required configuration as environment variable for each service so that the services' code and configuration are completely detached from each other. The advantage of this approach is that the configuration can easily be replaced for different deployments (e.g. production system, local developer system or test system) without the need to adjust any code.

### IV. Backing services

The resources each service consumes are declared in the previously explained environment file. This applies to third party resources (Twitter API, AWS Lambda, redis cache, ...) as well as to our own services, so there is no distinction between them. The following snippet shows an excerpt of the `.env`-file:

````
# configuration of AWS Lambda
LAMBDA_REGION=eu-central-1
LAMBDA_ROLE=arn:aws:iam::418015462131:role/lambda_basic_execution

# configuration of redis cache
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# configuration of twitter endpoint
TWITTER_URL=https://stream.twitter.com/1.1/statuses/filter.json?filter_level=none
````

### V. Build, release, run

The twelve-factor app guideline advises three separated stages to bring an application from source up and running.

The first stage is called **build stage** and contains the steps to fetch external dependencies and create a build. Due JavaScript code will be interpreted and thus no compile step is required, we can disregard any code compilation for the backend services and only have to download external dependencies via node. At that point, also the dependencies for the Elm-application are resolved and the Elm-scripts get compiled to vanilla JavaScript, HTML and CSS. The steps for the first stage are automatically invoked from Travis CI when code changes are commited and pushed to the master branch (see `Continous Integration` for a detailed explanation). At this time, Travis triggers all code test. If any test fails, the release cycle is stopped immediately. If everything went fine, Travis continues with the second stage.

In the second stage named **release**, Travis fetches the `.env` file from the private Git repository and bundles it with the rest of the code to a zip-file. This zip-file also contains the previously installed npm dependencies which allows the unpacked application to be run immediately on any machine. After successfully bundling the app, the zip-file is deployed to an AWS S3 bucket.

In the third and last stage **run**, Travis triggers AWS CodeDeploy which fetches and extracts the previously uploaded zip-file and starts the service instances.

All three stages are highly automated and don't require any intervention of a developer. If the build or release stage fail, Travis updates a 'batch' (i.e. a svg-image with a fixed url) which is imported in the projects' [README.md-file](https://github.com/cloudy-sentiment-analysis/CloudyMcCloudface/blob/master/README.md). This way, each developer can instantly recognize if the build failed and act accordingly.

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/build-passing.png "Badge for a passing build") Travis badge for a passing build.

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/build-failing.png "Badge for a failing build") Travis badge for a failing build.

### VI. Processes

The twelve-factor app guideline insists to run the app as one or more stateless processes with a share-nothing attitude. This concept simplifies the replacing of existing service instances with new ones as well as the additional startup of new instances when the rest of the system is already up and running.

The *TSA* app has two different kinds of state:

- *State 1*: which user belonging to which tenant tracked which keywords

    The mapping between tenants, users, and keywords is stored in the redis cache. E.g. when the *tweetstream-service* goes down for a few seconds, the information is still kept in the key value store. When the service restarts, it requests the information from redis and thus is able to reconnect to twitter with the given credentials and keywords. This stateless flow allows us to shutdown each service type and the application will continue working when the service gets restarted. This applies to the *recorder-service / webserver-serivce*.

- *State 2*: which user belonging to which tenant wants to record which keywords for what time frame

    It is not sufficient to store this type of information only in redis, because a user could schedule a record for in a few weeks or months. When the redis cache would be restarted, this information would be lost, so the record schedule is additionally stored in the permanent NoSQL storage DynamoDB. 

Note: In contrast to REST-APIs which are stateless by convention, websocket connections can be seen as a kind of state. In this case, the client won't receive any more analyzed tweets when the *webserver-service* goes down and the connection is lost. We circumvent this issue by resending the 'track'-message from our Elm-Client to the *webserver-service* when the client didn't receive any response from the *webserver-service* for a given amount of time (20 seconds). This will reestablish a lost connection and thus the flow of analyzed tweets will continue automatically without the need of the user having to reload the page manually.

### VII. Port binding

Due to the fact that the services are implemented with Node.js, there is no need for an external webserver container like Apache or HTTPD. So all our services are completely self-contained by relying on Node.js' internal http module. The port binding itself is declared in the configuration environment file `.env` whereby the services can be sticked to each other as described in the section `Backing Services`.

### VIII. Concurrency

According to the twelve-factor methodology an application should scale out via the process model. Although some issues arose in the beginning as a direct violation of this rule, described mo


### IX. Disposability

Using Node.js with the V8 Chrome engine, the overhead for startup time as well as shutdown time for a service / process is insignificant. This brings a great benefit when it comes to a new deployment because down time can be neglected.
By the usage of redis, the apps are designed to be robust against sudden death events. A detailed explanation about the robustness of the services including different scenarios can be found in the section `Let the battles begin`.

### X. Dev/prod parity

The twelve-factor principles defines three substantial gaps between development and production:

1. The **time** gap: With a twelve-factor app, the time between deployments should be performed in a few hours. We even fall below this time with our automated Continuous Deployment strategy which takes mere minutes from push to running on the production system.

2. The **personnal** gap: We as developers are also those who are responsible for the deployment and production processes. Thus we follow the statement of Werner Vogels (CTO at Amazon) from 2006: `You build it, you run it`.

3. The **tools** gap: The gap between the development environment and the production environment should be as small as possible by using the same tools and services on both systems. Our production system is running on AWS whereby we use Localstack for local development. Localstack is an open source project from Atlassian which provides a almost fully functional local AWS cloud stack in a docker container. Therefore we are able to develop and test our application before changes are pushed to the production system on AWS.

### XI. Logs

Each of our services writes relevant log messages to the console (stdout and stderr) as suggested for a twelve-factor app.  
Two different scripts were developed for logging purposes:

1. *dynamodb-logger.js*:

    This script receives log messages from other services via the operating system pipe. Both channels, stdin and stderr are supported to allow different log levels. This script then stores the incoming log messages into a DynamoDB. The service which is logged can be given a name as a command line argument for the *dynamodb-logger*.
    To be able to identify the logs of each service, the dynamodb-logger creates a uuid4 each time it gets started which is also tracked in the database. This is necessary when multiple instances of the same service type (i.e. the same name) are logging. This unique identifier enables the possibility to retrace which service instance created which log statements.

    The following snippet shows how to use the *dynamodb-logger* script to log the messages from an imaginary service called *some-cool-service* which is implemented in the file `someCoolService.js`:

    ```
    node someCoolService.js | node dynamodb-logger.js some-cool-service
    ```

    A huge gain of this concept is that the services themselves don't have to care about log files or log strategies. This way of logging can also be used for non-Node.js-services because logging is done with the help of the operating system (pipe) and does not rely on a specific language or log library.

2. *log-rest.js*:

    This service provides a REST API to query the logs stored the previously mentioned DynamoDB. The output of the *log-rest-service* itself can also be logged using the *dynamodb-logger*-script:

    ```
    node log-rest.js | node dynamodb-logger.js log-rest-service
    ```

### XII. Admin processes

// todo: check ich nicht

# Implementation

This chapter focuses on the implementation of the most critical components of the application, the state management and the synchronization strategies.

## RabbitMQ vs Redis

A prototype of *TSA* was implemented using RabbitMQ for inter-service communication, e.g. passing analyzed tweets from *tweetstream-service* to the *webserver-service*. This implementation worked quite well for message passing but RabbitMQ was not enough to fulfill our requirements: the state information (i.e. which user tracked which keywords) was lost when a *tweetstream-service* went down, because the service stored this information in main memory. This lead to the problem that the clients didn't receive any more tweets, because after a restart, the *tweetstream-service* no longer knew about the state he had before. This absolutely disagreed with the stateless process and share-nothing concept. 
This is why redis was chosen as a distributed cache for storing the app's state. When a service goes down and restarts a few seconds later, it is now able to query the current state information from redis and is able to create a new connection to the Twitter Streaming API. Due to the fact that redis also provides a reliable fast publish/subscribe messaging model, it was also chosen for inter-service communication instead of RabbitMQ .
This seemed to fix the state loss problems. Except when multiple instances of the *tweetstream-service* were started at the same time...

## Let the Battles Begin

The following chapters describes the problems that occurred when running multiple instances of the *tweetstream-service* and the implementations details of the  synchronization algorithm that was used to solve these problems.

### Twitter API Restrictions 

Twitter imposes very strict limitations for their API usage. This means that it is only allowed to hold one connection to the Streaming API at the same time with the same twitter account credentials, i.e. an o-auth-token. The creation of a new connection causes the oldest connection to be closed. Twitter also checks for inflative connection tries which may entail an IP ban.

### Running Multiple Instances of *tweetstream-service*

Whenever a user tracks keywords, the relevant information, i.e  tenant + user + keywords, is stored in the redis database. As a result the *tweetstream-service* will automatically be notified via redis keyspace events that there is a new user whose keywords need to be tracked. Hereupon the *tweetstream-service* will create a connection to the Twitter Streaming API in order to receive tweets for the given keywords.
When there are two or more instances of the *tweetstream-service* up and running, each instance tries to connect to the Twitter API, what could potentially result in an IP ban. This is why a distributed synchronization mechanism to prevent the creation of multiple streams for one twitter account, respectively o-auth-token / tenant, had to be invented.

### Requirements for the Synchronization Algorithm

We defined the following requirements the synchronization algorithm has to fulfill in order to ensure a faultless behavior for *TSA*:

- operate correctly with any number of *tweetstream*-instances
- exactly one *tweetstream*-instance must(!) 'win the battle', i.e. get a lock
- when a lock is held by any *tweetstream*-instance, no other instance may get the lock as long as the lock is held
- when a *tweetstream-service* holds a lock but then stops or crashes, the lock must still be released
- when a lock is released, all other services must be allowed to try to acquire the lock

### The 'battle' Algorithm

The `battle` algorithm is a synchronization algorithm that ensures that only one *tweetstream*-instance can acquire the lock for a tenant.
The algorithm was implemented with the help of redis' `incr`-command which atomically increments the value of a redis key by 1 and returns the new value.
If the redis key does not exist when `incr` is called, the command will create the variable with the initial value of 0.
As soon as lock is released all *tweetstream*-instances try to acquire it by calling the redis `incr`-command on a specific redis key. 
Since the operation is atomic only one instance will receive the return value == 1. All other services will get return values > 1.
The service that receives the value 1 is the winner of the `battle` and therefor receives the lock.
Any subsequent `incr` calls by other *tweetstream*-instances will receive a return value greater than 1 and will not receive the lock.

The following code shows how the algorithm works:

```javascript
/*
battleForTenant is a function which expects a tenantId and
returns a promise which resolves the following object:
{
    wonBattle: true if you won the battle (i.e. you hold the lock), otherwise false
    tenant:    o-auth token we need to connect to twitter or null, if you lost the battle
}
*/
const battleForTenant = (tenantId) => new Promise((resolve, reject) => {    
    // 1. create a redis transaction     
  redisClient.multi()         
    // 2. get o-auth-credentials for the tenant with id 'tenantId' 
    .get(`tenants->${tenantId}`) 
    // 3. increment the 'battle-counter' for this tenant
    .incr(`battle:tenants->${tenantId}`)
    // 4. set an expiration on the battle
    .expire(`battle:tenants->${tenantId}`, expiration)           
    // 5. start the transaction  
    .execAsync()
    .then(response => {
      // redis response is an array because we executed a transaction
      const oAuthCredentials = JSON.parse(response[0]);
      const battleCounter = response[1];
      // only one service will receive battleCounter with value 1        
      const wonBattle = (battleCounter == 1);
      if (oAuthCredentials && wonBattle) {
        // we won the battle
        resolve({wonBattle: true, tenant: oAuthCredentials});
      } else {    
        // we lost the battle but we still fulfill our promise                    
        resolve({wonBattle: false, tenant: null});    
      }
    })                
    .catch(err => reject(err)); // problem with redis?  
});
```

### Keeping the Lock

In redis a key can receive an expiration time. When the key expires it is deleted and an event is published. By setting a new expiration time the previous set expiration time can be overridden. This mechanism is used to automatically release a lock if a service goes down.
To keep their locks each *tweetstream*-instance periodically resets the expiration time for all keys, i.e. locks, it holds. If an instance fails to do so the key expires and all the other *tweetstream*-instances receive an event that a key was deleted and start to `battle` for the tenant associated with that key.

# Continuous Integration

The continuous integration server of choice for many open source projects is currently Travis-CI.
Travis-CI is a cloud based service that provides continuous integration for a multitude of languages.
It is free of charge for open source software.
After signing in to Travis-CI with a github account, the accounts repositories can be activated for CI.
Every push to an activated repository triggers a build.
The configuration for the build is done via the YAML file `.travis.yml` that needs to reside in the root directory of the repository.

In our case the required build steps are roughly:

*Build*

* Install the dependencies of the webserver module.
* Install the dependencies of the lambda module.
* Run the test against the webserver.
* Compile the Elm project to an HTML file.

*Deploy*

* Move the generated HTML file to the webserver.
* Fetch the production .env file from a private repository.
* Move the .env file to the webserver.
* Create a versioned ZIP file of the webserver.
* Save that ZIP into an AWS S3 bucket.
* Deploy the lambda module to AWS lambda.
* Trigger AWS CodeDeploy to restart services with new ZIP.

The deploy steps are configure to only run when changes to the master branch occur.
With this setup, a single push or merge to the master triggers the build and deployment of all production relevant code.
Additionally deployments to dedicated development instances on AWS could be configured in just a few minutes.
This would allow to have two identical AWS setups running at the same time, where one setups represents the master branch and the other the development branch of the project.
Because of the additional costs that come with running two instances of every service we decided against running a production and development environment simultaneously.

# Deployment

The deployment of the app is realized with AWS CodeDeploy and get triggered from Travis CI. CodeDeploy receives deployment information such as bucket name, archive name and which AWS EC2 instances (deployment group) to deploy from Travis as well. In AWS CodeDeploy a set of EC2 instances is called as a *deployment group*. In order to deploy and run each of our services separately we configured three different deployment groups which can be triggered separately. The deployment groups included the last deployment status are shown in the following image. 

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/deployment-groups.png "AWS deployment groups") AWS deployment groups.

Each of the deployment groups recognize the affected EC2 instances by their membership in an auto scaling group. Due this setup, CodeDeploy can easily deploy one service to several EC2 instances. Also CodeDeploy will be triggered automatically when the configured auto scaling groups create a new instance. With the `appspec.yml` file we describe which actions should be executed during deployment. In our case we call an installation bash script after CodeDeploy extracted the archive on the EC2 instance. This bash script updates the code and restarts the service depending on the deployment group.

Because our deployment procedure is highly automated, no manual steps are required to reproduce a deployment. Just push code changes to the master branch and a new deployment will be initiated automatically.
  

# Operations

## How to monitor the app

For monitoring the app we use AWS CloudWatch, a monitoring service that is provided by AWS. With AWS CloudWatch we have access to several metrics and log files. The important metrics for the app are:

- Incoming Network Traffic
- Outgoing Network Traffic
- CPU Utilization

Especially the incoming and outgoing network traffic is very important, because CloudWatch uses them to set alarms which trigger the different auto scaling groups for creating or deleting an EC2 instance. The following image shows the incoming network traffic for the three defined auto scaling groups of our app.

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/cloudwatch-networkIn-metric.png "AWS CloudWatch monitoring incoming network traffic") AWS CloudWatch monitoring incoming network traffic.

Using these metrics also helped us to configure our auto scaling groups correctly. In addition to the metrics we can also read the logs of AWS Lambda which will be provided by CloudWatch too.

## How to troubleshoot

When an error occurs, then several steps can be done to troubleshoot. Firstly, we can look at the metrics and logs provided by AWS CloudWatch. This metrics can give a hint which instance operates not as desired. Next we can look at the logs of the services, which are persisted in AWS DynamoDB. After the error was found, we can reproduce him locally and fix him. Thanks to our highly automated deployment process, we can quickly deploy the fix withing a few minutes.

# Cost Calculation
## cost model
The following graphic gives an estimate of the monthly cost for running the application in the AWS cloud.

The calculation assumes 1000 concurrent users and 100 concurrent recordings at any given time.

![AWS monthly cost](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/monthly-cost.png "AWS monthly cost") AWS monthly cost. *Calculated with cloudcraft.io*

Not included in this graphic is the cost for outgoing network traffic, which adds another 140€ each month for 1000 concurrent users and increases the monthly total to ~340€.

## Possible Charging Model

When creating a charging model the two main features of the app have to be taken into consideration. The first is the real time analysis which produces a huge amount of outgoing network traffic. Here it would make sense to charge each user or tenant by the total analysis time. This data can be gathered relatively ease by listening to redis events.
The second component is the recording of tweets. Outgoing network traffic is not as much an issue in this case, but storing the analyzed tweets is a massiv cost factor.
What needs to be taken into consideration as well, is the fact that recordings are stored by tenant.
Therefor it would make sense to charge each tenant for the total time of all stored recordings.

## Costs for an Half an Hour Test Run

It would cost about 15 cents to run the service for half an hour.
