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
    
- *tweet-analyzer service*: The tweet-analyzer is a AWS LAMBDA function which computes the following parameters for a bunch of tweets based on the tweet text/sentiment:
    - mean
    - variance
    - standard deviation
    - 0.25 quantile
    - 0.50 quantile (i.e. median)
    - 0.75 quantile
          
- *log service*:

    The log services is a simple Node.js application which receives console outputs (stdout as well as stderr) from all the other services explained before via operating system pipes. These messages are then stored into AWS Dynamo database. 
    
    
The *TSA* frontend is written in Elm, a functional programming which compiles to HTML, CSS and JavaScript. Client applications connect to the serverside websocket in order to receive statistics for analyzed tweets. The analyzed tweets are then visualized with curve charts.

### overall design and data stores

The communication between the *tweet-analyzer service* and the *webserver service* is realized with redis' publish/subscribe messaging paradigm.

The redis cache also stores information about whick user tracked which keywords.

In order to persist analyzed tweets, a DynamoDB is used.

### implementation of the functionality



### external cloud resource types

### scaling
- tenants -> scale up main_tweetstreams
- users -> scale up webserver.js
- tweets -> scale up redis + auto scaling with AWS lambda

### multi-tenancy
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