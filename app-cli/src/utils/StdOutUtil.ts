const chalk = require('chalk');
class StdOutUtils {
	printMessage(message: string) {
		console.log(message);
	}

	printMessageAndExit(message: string) {
		console.log(message);

		process.exit(0);
	}

	printGreenMessage(message: string, exit = false) {
		console.log(`${chalk.green(message)}`);

		exit && process.exit(0);
	}

	printMagentaMessage(message: string, exit = false) {
		console.log(`${chalk.magenta(message)}`);

		exit && process.exit(0);
	}

	printError(error: string, exit = false) {
		console.log(`${chalk.bold.red(error)}`);

		exit && process.exit(0);
	}

	errorHandler(error: any) {
		if (error.status) {
			this.printError(`\nError: ${error.status}\nError: ${error.description}`, true);
		} else {
			this.printError(`\nError: ${error}`, true);
		}
	}
}
export default new StdOutUtils();
