const fs = require("fs-extra")
const { printError } = require("./messageHandler")

function validateIsGitRepository() {
  const gitFolderExists = fs.pathExistsSync("./.git")

  if (!gitFolderExists) {
    printError(
      "\n**** ERROR: You are not in a git root directory. This command will only deploys the current directory ****\n",
      true
    )
  }
}

function validateDefinitionFile() {
  const captainDefinitionExists = fs.pathExistsSync("./captain-definition")

  if (!captainDefinitionExists) {
    printError(
      "\n**** ERROR: captain-definition file cannot be found. Please see docs! ****\n",
      true
    )
  }

  const contents = fs.readFileSync("./captain-definition", "utf8")
  let contentsJson = null

  try {
    contentsJson = JSON.parse(contents)
  } catch (e) {
    printError(
      `**** ERROR: captain-definition file is not a valid JSON! ****\n Error:${e}`,
      true
    )
  }

  if (!contentsJson.schemaVersion) {
    printError(
      "**** ERROR: captain-definition needs schemaVersion. Please see docs! ****",
      true
    )
  }

  if (!contentsJson.templateId && !contentsJson.dockerfileLines) {
    printError(
      "**** ERROR: captain-definition needs templateId or dockerfileLines. Please see docs! ****",
      true
    )
  }

  if (contentsJson.templateId && contentsJson.dockerfileLines) {
    printError(
      "**** ERROR: captain-definition needs templateId or dockerfileLines, NOT BOTH! Please see docs! ****",
      true
    )
  }
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
  optionIsGiven
}
