const chalk = require("chalk");
function printMessage(message) {
    console.log(message);
}
function printMessageAndExit(message) {
    console.log(message);
    process.exit(0);
}
function printGreenMessage(message, exit = false) {
    console.log(`${chalk.green(message)}`);
    exit && process.exit(0);
}
function printMagentaMessage(message, exit = false) {
    console.log(`${chalk.magenta(message)}`);
    exit && process.exit(0);
}
function printError(error, exit = false) {
    console.log(`${chalk.bold.red(error)}`);
    exit && process.exit(0);
}
function errorHandler(error) {
    if (error.status) {
        printError(`\nError: ${error.status}\nError: ${error.description}`, true);
    }
    else {
        printError(`\nError: ${error}`, true);
    }
}
module.exports = {
    printMessage,
    printMessageAndExit,
    printError,
    printGreenMessage,
    printMagentaMessage,
    errorHandler
};
//# sourceMappingURL=messageHandler.js.map