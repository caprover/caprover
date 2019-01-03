const fs = require("fs-extra")
const DeployApi = require("../api/DeployApi")
const { printError } = require("./messageHandler")
const { requestLogin } = require("../lib/login")
const { initMachineFromLocalStorage } = require("../utils/machineUtils")

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

  if (contentsJson) {
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
}

// Only show that question if there is no option given as argument
function optionIsNotGiven(allOptions, option) {
  // console.log(allOptions)
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

async function validateAuthentication() {
  // 1. Check if valid auth
  const isAuthenticated = await DeployApi.isAuthTokenValid()

  // 2. Request login
  // 3. Login
  // 4. Update token
  if (!isAuthenticated) {
    const loggedInStatus = await requestLogin()

    // Refresh token in DeployApi
    initMachineFromLocalStorage()

    return loggedInStatus
  } else {
    return Boolean(isAuthenticated)
  }
}

module.exports = {
  validateAuthentication,
  validateIsGitRepository,
  validateDefinitionFile,
  isIpAddress,
  optionIsNotGiven
}
