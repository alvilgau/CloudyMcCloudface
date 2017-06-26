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
    forever start -a -o /var/log/cloudy-out.log -e /var/log/cloudy-err.log webserver.js
    forever start log/dynamodb-logger.js webserver INFO out.log
    forever start log/dynamodb-logger.js webserver ERROR err.log
    forever start log/log-rest.js
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_stream" ]
then
    forever start -a -o /var/log/cloudy-out.log -e /var/log/cloudy-err.log stream/main-tweetstream.js
    forever start log/dynamodb-logger.js tweetstream INFO out.log
    forever start log/dynamodb-logger.js tweetstream ERROR err.log
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_recorder" ]
then
    forever start -a -o /var/log/cloudy-out.log -e /var/log/cloudy-err.log record/recorder.js
    forever start log/dynamodb-logger.js recorder INFO out.log
    forever start log/dynamodb-logger.js recorder ERROR err.log
fi
