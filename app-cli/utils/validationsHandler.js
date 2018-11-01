const fs = require("fs-extra")
const { printErrorAndExit } = require("./errorHandler")

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

module.exports = {
  validateIsGitRepository,
  validateDefinitionFile
}
