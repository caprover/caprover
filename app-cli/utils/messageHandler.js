const chalk = require("chalk")

function printMessage(message) {
  console.log(message)
}

function printMessageAndExit(message) {
  console.log(message)

  process.exit(0)
}

function printGreenMessage(message) {
  console.log(`${chalk.green(message)}`)
}

function printMagentaMessage(message) {
  console.log(`${chalk.magenta(message)}`)
}

function printError(error) {
  console.log(`${chalk.bold.red(error)}`)
}

function printErrorAndExit(error) {
  console.log(`${printError(error)}`)

  process.exit(0)
}

function errorHandler(error) {
  if (error.status) {
    printErrorAndExit(`\nError: ${error.status}\nError: ${error.description}`)
  } else {
    printErrorAndExit(`\nError: ${error}`)
  }
}

module.exports = {
  printMessage,
  printMessageAndExit,
  printErrorAndExit,
  printError,
  printGreenMessage,
  printMagentaMessage,
  errorHandler
}
