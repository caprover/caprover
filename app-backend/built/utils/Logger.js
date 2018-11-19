/**
 * Created by kasra on 27/06/17.
 */
var CaptainConstants = require('./CaptainConstants');
var moment = require('moment');
function errorize(error) {
    if (!(error instanceof Error)) {
        return new Error('Wrapped: ' + (error ? error : 'NULL'));
    }
    return error;
}
function getTime() {
    return '\x1b[36m' + moment().format('MMMM Do YYYY, h:mm:ss.SSS a    ') + '\x1b[0m';
}
module.exports = {
    d: function (msg) {
        console.log(getTime() + msg + '');
    },
    w: function (msg) {
        console.log(getTime() + msg + '');
    },
    dev: function (msg) {
        if (CaptainConstants.isDebug) {
            console.log(getTime() + '########### ' + msg + '');
        }
    },
    e: function (msgOrError) {
        var err = errorize(msgOrError);
        console.error(getTime() + err + '\n' + err.stack);
    }
};
