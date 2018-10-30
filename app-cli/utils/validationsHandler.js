const fs = require("fs-extra")
const printErrorAndExit = require("./errorHandler")

function validateIsGitRepository() {
  if (!fs.pathExistsSync("./.git")) {
    printErrorAndExit(
      "**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****"
    )
  }
}

function validateDefinitionFile() {
  if (!fs.pathExistsSync("./captain-definition")) {
    printErrorAndExit(
      "**** ERROR: captain-definition file cannot be found. Please see docs! ****"
    )
  }
}

module.exports = {
  validateIsGitRepository,
  validateDefinitionFile
}
