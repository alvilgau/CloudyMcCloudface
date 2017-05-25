console.log('Loading function');

exports.handler = function (event, context, callback) {
    console.log('Running helloworld lambda function');
    callback(null, {'foo': 'bar'});
};
