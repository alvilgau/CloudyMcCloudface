# Twitter Sentiment Analysis

*from Alexander Vilgauk, Andreas Sayn and Markus Heilig* 

## Intruduction

Twitter Sentiment Analysis *(TSA)* is a cloud software platform for massive tweet analysis. TSA is a multi tenancy application which allows the user to run real-time sentiment analysis on one or multiple twitter streams. A web client then will visualize the analysis results in real time. TSA also gives the user the possibility to record the stream for a specified time.

In order to handle a any amount of tweets and clients concurrently TSA needs to be highly scalable and is therefore a perfect fit for "The Cloud".

## Application Design

The *TSA* backend is realized with microservices, all written in JavaScript for Node.js.

These services are:

- *webserver service*:
    
    The webserver serves the client application file (index.html), exposes a REST API for recording analyzed tweets for given keywords and also starts a websocket server.
    
- *tweetstream service*:

    The Tweetstream service subscribes to the twitter api and receives tweets in real time. These tweets are then published to the tweet analyzer.
    
- *tweet-analyzer service*:

    The tweet-analyzer is a AWS LAMBDA function which computes statistical parameters for a bunch of tweets based on the sentiment of the tweets' text.
    
- *recorder service*:
    
    The recorder service persists the analyzed tweets for a certain time in the AWS DynamoDB.
          
- *log service*:

    The log services is a simple Node.js application which receives console outputs (stdout as well as stderr) from all the other services explained before via operating system pipes. These messages are then stored into AWS Dynamo database. 
    
    
The *TSA* frontend is written in Elm, a functional programming which compiles to HTML, CSS and JavaScript. Client applications connect to the serverside websocket in order to receive statistics for analyzed tweets. The analyzed tweets are then visualized with curve charts.

### overall design and data stores

#### Interprocess communication

When a new user launches the app and enters some keywords to track, the client sends a JSON message to the websocket server with the specified keywords and optionally some tenant information.
After the server receives such a message, the following information will be tracked in redis:
- tenant information if specified, i.e. twitter o-auth credentials
- user information, represented as uuid
- keywords the user wants to track
So the redis cache stores the information about which user belonging to which tenant tracked which keywords. The *TSA* application provides a 'default tenant' for all users which have not specified a tenant.

When redis variables (called *keys*) are set, changed, deleted or expired, redis publishes so called keyspace events which can be subscribed from other services to receive app specific notifications. *TSA* uses this events in the *tweetstream-server* to get notified when a user wants to track keywords. In this case, the tweetstream-server can create a new stream connection to twitter for the new keywords.

#### Tweet analysis

Shortly after the *tweetstream-service* created a http-connection stream to the twitter api, the service will receive tweets based on the specified keywords. Tweets are JSON objects including the tweet text and emojis, the time when the tweet was created, how many times a tweet was retweeted, geolocation information and much more. Right now, only the tweet text including the emojis is used for sentiment analysis and thus will be extracted from the tweet JSON object and stored temporarily in memory. 
The *tweetstream-service* has configured a periodic timer which expires after three seconds. A callback function registered on the timer will then send all temporarily stored tweet texts to *tweet-analyzer service* which is implemented as a AWS Lambda function.
This function takes an array of tweets (text) as input parameter and returns a json object containing the following statistical parameters about the tweets' sentiment:

    - mean
    - variance
    - standard deviation
    - 0.25 quantile
    - 0.50 quantile (i.e. median)
    - 0.75 quantile

The sentiment analysis is realized with a Node.js module called [sentiment](https://github.com/thisandagain/sentiment) which is based on the AFINN-165 wordlist as well as Emoji Sentiment Ranking to perform the analysis.

After the calculation is done, the *tweetstream-service* publishes the results on redis channels on which other services can subscribe to. This way, the *webserver-service* is able to subscribe for analyzed tweets and send the results back to the client applications via websocket messages; the *recorder service* is able to subscribe in order to store the analyzed tweets results.

#### Tweet recording
Through a REST-API which is included in the webserver, the user has the possibility to record analyzed tweets for a certain period of time. All necessary data for recording will be persisted in a DynamoDB. The start and end time for the record will be cached in Redis. When one of this keys expires, Redis sends a notification to the recorder service. Through this notifications the recorder service knows when he has to record and when not. During the recording the analysed tweets will be persisted in a DynamoDB so that the user can access them later.



### implementation of the functionality


### external cloud resource types

### scaling

There are three different kinds of scaling scenarios for *TSA*.

1. Scale for tenants

When the number of tenant increases, then there will be more http-connections to the twitter api stream (one per tenant). In order to handle several streams, new instances of the *tweet-stream service* are required.

2. Scale for users

When the number of user increases, then there are a lot of websocket connections (one per user). In order to handle a huge amount of users, new instances of the *webserver service* need to be started.

3. Scale for tweets

When there are a lot of tweets which have to be analyzed, there is nothing further to do! The analyzer function is a stateless AWS Lambda function which is scaled automatically by Amazon.

todo: alex, which scaling groups are defined and how are they configured?

### multi-tenancy

#### Definition of user
A user is defined as a consumer of our service, e.g. someone who uses the *TSA web application*.
From the technical point of view, a user is represented as a websocket connection to the websocket server. Each websocket-connection is mapped by a uuid which will last for the whole socket session. This uuid (we call it 'user-id') also maps the keywords the user wants to track. The mapping is used to decide wich analyzed tweets will be sent to which users.

#### Definition of tenant
When you want to access the twitter api, you have to register a twitter application before to get access tokens. These access tokens are used from twitter to identify API access.
*TSA* has multi-tenancy support built-in. In the context of *TSA* a tenant is defined as a twitter application. When you register a twitter application twitter generates four significant values which are required to access the twitter api:
 - Consumer Key (API Key)
 - Consumer Secret (API Secret)
 - Access Token
 - Access Token Secret

So *TSA* gives you the opportunity to use your own twitter application credentials to access the twitter api. When different users share the same credentials to use *TSA*, they will be seen as 'one tenant' belonging to one organization (twitter account) from *TSA*s point of view.

*TSA* has a predefined tenant (we call it 'default tenant', which is a twitter application called 'CloudyMcCloudface-tweet-analyzer') for users who don't want to register a twitter application theirselves.



### 12 factors

*TSA* is build around the twelve-factor methodology in order to fulfill the requirements for a software-as-a-service application. The steps performed will be described in the following subsections.

#### I. Codebase

The source code for the project is tracked in a public Git repository on [GitHub](https://github.com/cloudy-sentiment-analysis/CloudyMcCloudface). This repository contains the whole application (backend-services as well as frontend-client) and thus can easily be used for deployments on different systems (e.g. for production-deployment on AWS or local deployment for development reasons running with [localstack](https://github.com/atlassian/localstack)).

Note: 
The configuration file for the *TSA-services* is tracked in a separate private Git repository on [GitHub] due to security issues like private o-auth credentials.

#### II. Dependencies

To manage their dependencies, the Node.js-services use the node package manager `npm` which is shiped with a common Node.js-installation. The dependencies are declared in a configuration file called `package.json` and can easily be installed running the following console command, so there is no need to store external modules in the repository itself:

```bash
npm i
```

#### III. Config

The services receive their configuration during their startup by processing a file called `.env`. This file defines the required configuration as environment variable for each service so that the services' code and configuration are completely detached from each other. The advantage of this approach is that the configuration can easily be replaced for different deployments (e.g. production system, local developmer system or test system)
without the need to adjust any code.

#### IV. Backing services

The resources each service consumes are declared in the previsouly explained environment file. This applies to third party resources (Twitter Api, AWS Lambda, redis cache, ...) as well as to our own services, so there is no distinction between them. The following snippet shows an excerpt of the `.env`-file:

````
# configuration of AWS Lambda
LAMBDA_REGION=eu-central-1
LAMBDA_ROLE=arn:aws:iam::418015462131:role/lambda_basic_execution

# configuration of redis cache
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# configuration of twitter endpoint
TWITTER_URL=https://stream.twitter.com/1.1/statuses/filter.json?filter_level=none&stall_warnings=true
````

#### V. Build, release, run

The twelve-factor app guideline advises three separated stages to bring an application from source up and running.

The first stage is called *build stage* and contains the steps to fetch external dependencies and create a build. Due JavaScript is an interpreted and thus no compile step is required, we can disregard any code compilation for the backend services and only have to download external dependencies via node. At that point, also the dependencies for the Elm-application are resolved and the Elm-scripts get compiled to vanilla JavaScript, HTML and Css.  The steps for the first stage are automatically invoked from Travis CI when code changes are commited and pushed to the master branch (see `Continous Integration` for a detailed explanation). At this time, Travis triggers all code test. If any test would fail, the release cycle would stop right now. If everything went fine, Travis continues with the second stage.

In the second stage named *release* Travis fetches the `.env` file from the private Git repository and bundles it with the rest of the code to a .zip file. This zip-file then will be deployed to a AWS S3 instance.

In the third and last stage *run* Travis triggers AWS CodeDeploy which then extracts the previously uploaded zip-file and starts the service instances.

All three stages are highly automated and don't require any intervention of a developer. When any the build or release stage would fail, Travis updates a `batch` (.svg-image with a fixed url) which is imported in the projects' [README.md-file](https://github.com/cloudy-sentiment-analysis/CloudyMcCloudface/blob/master/README.md). This way, each developer instantly can recognize if the build failed and act accordingly.

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/build-passing.png "Badge for a passing build") Travis badge for a passing build.

![alt text](https://raw.githubusercontent.com/cloudy-sentiment-analysis/CloudyMcCloudface/master/doc/build-failing.png "Badge for a failing build") Travis badge for a failing build.

#### VI. Processes

The twelve-factor app guideline insists to run the app as one or more stateless processes with a share-nothing attitude. This concept simplifies the replacing of existing service instances with new ones as well as the additional startup of new instances while the rest of the system is already up.

The *TSA* app has two different kinds of state:

- *State 1*: which user belonging to which tenant tracked which keywords

    The mapping between tenants, users, and keywords is stored in the redis cache. E.g. when the *tweetstream-service* goes down for a few seconds, the information is still kept in the distributed key value store. When the service restarts, it requests the information from redis and thus is able to reconnect to twitter with the given credentials and keywords. This stateless flow allows us to shutdown each service type and the application will continue working when the specific service gets restarted. This is also valid for the *recorder-service / webserver-serivce*.

- *State 2*: which user belonging to which tenant wants to record which keywords for what time range

    It is not sufficient to store this type of information only in redis, because a user could schedule a record for in a few weeks or months. When the redis-db would be restarted, this information would be lost, so the record schedule is stored additionally in the permanent NoSQL storage DynamoDB. 

Note: In contrast to REST-APIs which are stateless by convention, websocket connections can be seen as a kind of state. In this case, the client won't receive any more analyzed tweets when the *webserver-service* goes down and the connection is lost. We circumvent this issue by resend the 'track'-message from our Elm-Client to the *webserver-service* when the client didn't receive any response from the *webserver-service* for a given amount of time (20 seconds). This will reestablish a lost connection and thus the flow of analyzed tweets will continue automatically without the need of the user having to reload the page manually.

#### VII. Port binding

Due the services are implemented with Node.js, there is no need for an external webserver container like Apache or HTTPD. So all our services are completely self-contained by relying on Node.js' internal http module. The port binding itself is declared in the configuration environment file `.env` whereby the services can be sticked to each other as described in the section `Backing Services`.

#### VIII. Concurrency

// TODO: versteh ich nicht

#### IX. Disposability

Using Node.js with the slightly V8 Chrome engine, the overhead for startup time as well as shutdown time for a service / process is picayune. This brings a great benefit when it comes to a new deployment becase down time can be neglected.
By the usage of redis, our apps are designed to be robust again sudden death events. A detailed explanation about the robustness of the services including different scenarios can be found in the section `Let the battles begin`.

#### X. Dev/prod parity

The twelve-factor principles defines three substantial gaps between developemtn and production:

1. The time gap: With a twelve-factor app, the time between deployments should be performed in a few hours. We even fall below this time with our automated Continous Deployment strategy which lasts only for several minutes.

2. The personnal gap: We as developers are also those who are responsible for the deployment and production processes. Thus we follow  the statement of Werner Vogels (CTO at Amazon) from 2006: `You build it, you run it`.

3. The tools gap: The gap between the development environment and the production environment should be as small as possible by using the same tools and services on both systems. Our production system is running on AWS whereby we used Localstack for local development. Localstack is an open source project from atlassian which provides a fully functional local AWS cloud stack. Therefore we are able to develop and test our application before changes are pushed to the production system on the amazon servers.

#### XI. Logs

Each of our services writes relevant log messages to the console (stdout and stderr) as suggested for a twelve-factor app.  
We then developed two different scripts for logging purposes:

1. *dynamodb-logger.js*:

    This script receives log messages from other services via the operating system pipe. Both channels, stdin and stderr are supported to allow different log levels. This script then stores the incoming log messages into a DynamoDB. The service which is logged can be given a name as a command line argument for the *dynamodb-logger*.
    To be able to identify the logs of each service, the dynamodb-logger creates a uuid4 each time it gets started which is also tracked in the database. This is necessary when multiple instances of the same service type (i.e. the same name) are logged. This unique identifier enables the possibility to retrace which service instance created which log statements.

    The following snippet shows how to use the *dynamodb-logger* script to log the messages from an imaginary service called *some-cool-service* which is implemented in the file `someCoolService.js`:

    ```
    node someCoolService.js | node dynamodb-logger.js some-cool-service
    ```

    A huge gain of this concept is that the services theirselves don't have to care about log files or log strategies. This way of logging can also be used for non-Node.js-services because logging is done with the help of the operating system (pipe) and does not rely on a specific log library.

2. *log-rest.js*:

    This service provides a REST API to query the logs stored the previously mentioned DynamoDB. The output of the *log-rest-service* itself can also be logged using the *dynamodb-logger*-script:

    ```
    node log-rest.js | node dynamodb-logger.js log-rest-service
    ```

#### XII. Admin processes

## Implementation

- first steps with rabbitmq -> not working for our purposes (information is lost if service goes down)
- now: redis
- "tenant battles"

## Installation
### deployment model
### how is app deployed

## Continuous Integration

The continuous integration server of choice for many open source projects is currently Travis-CI.
Travis-CI is a cloud based service that provides contiuous integration for a multitude languages.
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
* Trigger AWS CodeDeploy to deploy ZIP from AWS S3 bucket.

The deploy steps are configure to only run when changes to the master branch occur.
With this setup, a single push or merge to the master triggers the build and deployment of all production relevant code.
Additionally deployments to dedicated development instances on AWS could be configured in just a few minutes.
This would allow to have two identical AWS setups running at the same time, where one setups represents the master branch and the other the development branch of the project.
Because of the additional costs that come with running two instances of every service we decided against running a production and development environment simultaneously.


## Operations
### how to monitor the app
### how to troubleshoot
### how to deploy a new version

## Cost Calculation
### cost model
### possible charging model
### costs for an halb an hour test run