const chalk = require('chalk');

function printMessage(message: string) {
	console.log(message);
}

function printMessageAndExit(message: string) {
	console.log(message);

	process.exit(0);
}

function printGreenMessage(message: string, exit = false) {
	console.log(`${chalk.green(message)}`);

	exit && process.exit(0);
}

function printMagentaMessage(message: string, exit = false) {
	console.log(`${chalk.magenta(message)}`);

	exit && process.exit(0);
}

function printError(error: string, exit = false) {
	console.log(`${chalk.bold.red(error)}`);

	exit && process.exit(0);
}

function errorHandler(error: any) {
	if (error.status) {
		printError(`\nError: ${error.status}\nError: ${error.description}`, true);
	} else {
		printError(`\nError: ${error}`, true);
	}
}

export = {
	printMessage,
	printMessageAndExit,
	printError,
	printGreenMessage,
	printMagentaMessage,
	errorHandler
};
