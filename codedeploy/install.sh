#!/bin/bash
cd /home/ec2-user

# remove old version
rm -rf CloudyMcCloudface/webserver/

# move new version
mv webserver/ CloudyMcCloudface/

# restart service
cd /home/ec2-user/CloudyMcCloudface/webserver
forever stopall
if [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_webserver" ]
then
    #{ { { node webserver.js; } 2>&3 | sed >&2 's/^/[INFO] /'; } 3>&1 1>&2 | sed 's/^/[ERROR] /';} 2>&1 | node log/dynamodb-logger.js webserver-service
    forever start webserver.js
    forever start log/log-rest.js
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_stream" ]
then
    #{ { { node stream/main-tweetstream.js; } 2>&3 | sed >&2 's/^/[INFO] /'; } 3>&1 1>&2 | sed 's/^/[ERROR] /';} 2>&1 | node log/dynamodb-logger.js tweetstream-service
    forever start stream/main-tweetstream.js
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_recorder" ]
then
    #{ { { node record/recorder.js; } 2>&3 | sed >&2 's/^/[INFO] /'; } 3>&1 1>&2 | sed 's/^/[ERROR] /';} 2>&1 | node log/dynamodb-logger.js recorder-service
    forever start record/recorder.js
fi
