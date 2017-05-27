'use strict';

exports.handler = function (event, context, callback) {
    console.log('running sum function');
    console.log('number1 =', event.val1);
    console.log('number2 =', event.val2);

    const sum = event.val1 + event.val2;
    callback(null, {'sum': sum});
};
