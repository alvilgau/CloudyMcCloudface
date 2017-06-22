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
    forever start webserver.js
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_stream" ]
then
    forever start stream/main-tweetstream.js
elif [ "$DEPLOYMENT_GROUP_NAME" == "cloudy_recorder" ]
then
    forever start record/recorder.js
fi