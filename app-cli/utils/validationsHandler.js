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

  const contents = fs.readFileSync("./captain-definition", "utf8")
  let contentsJson = null

  try {
    contentsJson = JSON.parse(contents)
  } catch (e) {
    printErrorAndExit(
      `**** ERROR: captain-definition file is not a valid JSON! ****\n Error:${e}`
    )
  }

  if (!contentsJson.schemaVersion) {
    printErrorAndExit(
      "**** ERROR: captain-definition needs schemaVersion. Please see docs! ****"
    )
  }

  if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
    printErrorAndExit(
      "**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****"
    )
  }

  if (contentsJson.templateId && contentsJson.dockerfileLines) {
    printErrorAndExit(
      "**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****"
    )
  }
}

function isTarFileProvided(tarFilePath) {
  return tarFilePath
}

// Only show that question if there is no option given as argument
function optionIsGiven(allOptions, option) {
  if (allOptions[option]) {
    return false
  }

  return true
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
  isIpAddress,
  isTarFileProvided,
  optionIsGiven
}
