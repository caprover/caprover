const ora = require('ora');

function start(message) {
    return ora(message).start()
}

function stop(spinner) {
    spinner.stop();
}

function succeed(spinner) {
    spinner.succeed();
}

function fail(spinner) {
    spinner.fail();
}

module.exports = {
    start: start,
    stop: stop,
    succeed: succeed,
    fail: fail,
}