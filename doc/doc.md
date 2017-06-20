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

In order to persist analyzed tweets, a DynamoDB is used.
TODO: alex


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

### multi-tenancy

*TSA* has multi-tenancy support.

- twitter oauth credentials
- one tenant equals one http-stream
- one tenant may have unlimited users
- 'default tenant'

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

## Operations
### how to monitor the app
### how to troubleshoot
### how to deploy a new version

## Cost Calculation
### cost model
### possible charging model
### costs for an halb an hour test run