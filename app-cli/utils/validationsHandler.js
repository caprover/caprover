const fs = require("fs-extra")
const { printErrorAndExit } = require("./messageHandler")

function validateIsGitRepository() {
  const gitFolderExists = fs.pathExistsSync("./.git")

  if (!gitFolderExists) {
    printErrorAndExit(
      "\n**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****\n"
    )
  }
}

function validateDefinitionFile() {
  const captainDefinitionExists = fs.pathExistsSync("./captain-definition")

  if (!captainDefinitionExists) {
    printErrorAndExit(
      "\n**** ERROR: captain-definition file cannot be found. Please see docs! ****\n"
    )
  }
}

function isIpAddress(ipaddress) {
  if (
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
      ipaddress
    )
  ) {
    return true
  }

  return false
}

module.exports = {
  validateIsGitRepository,
  validateDefinitionFile,
  isIpAddress
}
