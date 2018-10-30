const chalk = require("chalk")

function printErrorAndExit(error) {
  console.log(`${chalk.bold.red(error)}\n\n`)

  process.exit(0)
}

module.exports = printErrorAndExit
