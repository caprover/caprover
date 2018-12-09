#!/usr/bin/env node
const MachineHelper = require("../helpers/MachineHelper")
const DeployApi = require("../api/DeployApi")
const LoginApi = require("../api/LoginApi")
const { printError, printMessage } = require("../utils/messageHandler")
const {
  validateIsGitRepository,
  validateDefinitionFile,
  optionIsGiven
} = require("../utils/validationsHandler")
const { requestLogin } = require("../lib/login")
const { getFileStream, uploadFile } = require("../utils/fileHelper")
const { gitArchiveFile } = require("../utils/fileHelper")
const fs = require("fs-extra")
const path = require("path")
const inquirer = require("inquirer")
const commandExistsSync = require("command-exists").sync

function initMachineFromLocalStorage() {
  const possibleApp = MachineHelper.apps.find(app => app.cwd === process.cwd())

  if (possibleApp) {
    DeployApi.setMachineToDeeploy(possibleApp.machineToDeploy)

    DeployApi.setAppName(possibleApp.appName)

    DeployApi.setBranchToPush(possibleApp.branchToPush)
  }
}

function deployAsDefaultValues() {
  const { appName, branchToPush, machineToDeploy } = DeployApi

  if (!appName || !branchToPush || !machineToDeploy) {
    printError(
      "Default deploy failed. There are no default options selected.",
      true
    )
  }

  printMessage(`Deploying to ${machineToDeploy.name}`)

  deployFromGitProject()
}

async function validateAuthentication() {
  // 1. Check if valid auth
  const isAuthenticated = await DeployApi.isAuthTokenValid()

  // 2. Request login
  // 3. Login
  // 4. Update token
  if (!isAuthenticated) {
    requestLogin()
  }
}

async function deployAsStateless(stateless, host, appName, branch, pass) {
  const isStateless = stateless && host && appName && pass

  if (isStateless) {
    // login first
    printMessage(`Trying to login to ${host}\n`)

    await LoginApi.loginMachine(host, pass)

    printMessage(`Starting stateless deploy to\n${host}\n${branch}\n${appName}`)

    await deployFromGitProject()
  }
}

async function deployFromTarFile(tarFile) {
  try {
    await validateAuthentication()

    // Send from tar file
    const filePath = tarFile
    const fileStream = getFileStream(filePath)
    const gitHash = "sendviatarfile"

    await uploadFile(filePath, fileStream, gitHash)
  } catch (e) {
    printError(e.message, true)
  }
}

function deployFromGitProject() {
  // TODO - Deploy from git folder

  if (!commandExistsSync("git")) {
    printError("'git' command not found...")

    printError(
      "Captain needs 'git' to create tar file of your source files...",
      true
    )
  }

  const zipFileNameToDeploy = "temporary-captain-to-deploy.tar"
  const zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy)

  printMessage(`Saving tar file to:\n${zipFileFullPath}\n`)

  // Removes the temporarly file created
  try {
    fs.removeSync(zipFileFullPath)
  } catch (e) {
    // IgnoreError
  }

  gitArchiveFile(zipFileFullPath, MachineHelper.branchToPush)
}

function deploy(options) {
  // Reads local storage and sets the machine if found
  initMachineFromLocalStorage()

  if (!options.tarFile) {
    validateIsGitRepository()

    validateDefinitionFile()
  }

  printMessage("Preparing deployment to Captain...\n")

  const questions = [
    {
      type: "list",
      name: "captainNameToDeploy",
      default: DeployApi.machineToDeploy.name || "",
      message: "Select the Captain Machine you want to deploy to:",
      choices: MachineHelper.getMachinesAsOptions(),
      when: () => optionIsGiven(options, "host")
    },
    {
      type: "input",
      default: DeployApi.branchToPush || "master",
      name: "branchToPush",
      message: "Enter the 'git' branch you would like to deploy:",
      when: () => optionIsGiven(options, "branch")
    },
    {
      type: "input",
      default: DeployApi.appName,
      name: "appName",
      message: "Enter the Captain app name this directory will be deployed to:",
      when: () => optionIsGiven(options, "appName")
    },
    {
      type: "confirm",
      name: "confirmedToDeploy",
      message:
        "Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.",
      default: true,
      when: () => optionIsGiven(options, "stateless")
    }
  ]

  inquirer.prompt(questions).then(answers => {
    if (!answers.confirmedToDeploy) {
      printMessage("\nOperation cancelled by the user...\n")

      process.exit(0)
    }

    const captainNameToDeploy = answers.captainNameToDeploy
    const branchToPush = answers.branchToPush || options.branch
    const appName = answers.appName || options.appName

    DeployApi.updateMachineToDeploy(captainNameToDeploy || options.host)

    DeployApi.setBranchToPush(branchToPush)

    DeployApi.setAppName(appName)

    printMessage(`Deploying to ${DeployApi.machineToDeploy.name}`)

    if (options.tarFile) {
      deployFromTarFile(options.tarFile)
    }

    // if (options.default) {
    //   deployAsDefaultValues()
    // }

    // if (options.stateless) {
    //   deployAsStateless()
    // }

    // deployFromGitProject()
  })
}

module.exports = deploy
