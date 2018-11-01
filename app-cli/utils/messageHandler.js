const chalk = require("chalk")

function printMessage(message) {
  console.log(message)
}

function printGreenMessage(message) {
  console.log(`${chalk.green(message)}`)
}

function printError(error) {
  console.log(`${chalk.bold.red(error)}`)
}

function printErrorAndExit(error) {
  console.log(`${printError(error)}`)

  process.exit(0)
}

module.exports = {
  printMessage,
  printErrorAndExit,
  printError,
  printGreenMessage
}
