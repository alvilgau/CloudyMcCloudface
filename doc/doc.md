# Twitter Sentiment Analysis

*from Alexander Vilgauk, Andreas Sayn und Markus Heilig* 

## Intruduction

Twitter Sentiment Analysis *(TSA)* is a cloud software platform for massive tweet analysis. TSA is a multi tenancy application which allows the user to run real-time sentiment analysis on one or multiple twitter streams. A web client then will visualize the analysis results in real time. TSA also gives the user the possibility to record the stream for a specified time.

In order to handle a any amount of tweets and clients concurrently TSA needs to be highly scalable and is therefore a perfect fit for "The Cloud".

## Application Design

The *TSA* backend is realized with microservices, all written in JavaScript for Node.js.

These services are:

- *webserver service*: The webserver serves the client application file (index.html), exposes a REST API for recording analyzed tweets for given keywords and also starts a websocket server.
    
- *tweetstream service*: The Tweetstream service subscribes to the twitter api and receives tweets in real time. These tweets are then published to the tweet analyzer.
    
- *tweet-analyzer service*: The tweet-analyzer is a AWS LAMBDA function which computes statistical parameters for a bunch of tweets based on the sentiment of the tweets' text.
          
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

#### Persisting analyzed tweets
TODO: alex ...

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
- codebase
- dependencies
- config
- backing services
- build, release, run
- processes
- port binding
- concurrency
- disposability
- dev/prod parity
- logs
- admin processes
### security

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