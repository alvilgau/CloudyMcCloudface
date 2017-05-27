# Backend

## Setup

1. install Redis: https://redis.io/download
2. install node packages: 
```bash
npm install
```

## Run

1. configure redis
```bash
redis-cli config set notify-keyspace-events KEA
```


2. run backend services:
```bash
npm start
```