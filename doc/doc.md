# Twitter Sentiment Analysis

*from Alexander Vilgauk, Andreas Sayn und Markus Heilig* 

## Intruduction

Twitter Sentiment Analysis *(TSA)* is a cloud software platform for massive tweet analysis. TSA is a multi tenancy application which allows the user to run real-time sentiment analysis on one or multiple twitter streams. A web client then will visualize the analysis results in real time. TSA also gives the user the possibility to record the stream for a specified time.

In order to handle a any amount of tweets and clients concurrently TSA needs to be highly scalable and is therefore a perfect fit for "The Cloud".

## Application Design

### overall design and data stores
- nodejs microservices
- elm frontend
- websockets
- twitter api
- lambda as tweet analyzer service
- redis as distributed memory + messaging system
- dynamodb for records

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