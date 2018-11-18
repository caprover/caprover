#!/usr/bin/env node
const MachineHelper = require("../helpers/MachineHelper")
const DeployApi = require("../api/DeployApi")
const { printError, printMessage } = require("../utils/messageHandler")
const {
  validateIsGitRepository,
  validateDefinitionFile,
  isTarFileProvided,
  optionIsGiven
} = require("../utils/validationsHandler")
const { requestLogin } = require("../lib/login")
const { getFileStream, uploadFile } = require("../utils/fileHelper")
const { gitArchiveFile } = require("../utils/fileHelper")
const fs = require("fs-extra")
const path = require("path")
const inquirer = require("inquirer")
const commandExistsSync = require("command-exists").sync
const MACHINE_TO_DEPLOY = "machineToDeploy"
const {
  EMPTY_STRING,
  DEFAULT_BRANCH_TO_PUSH,
  DEFAULT_APP_NAME
} = require("../utils/constants")

// Gets default value for propType that is stored in a directory.
// Replaces getAppForDirectory
// Check if the command is running inside the directory of an existing app
function getPropForDirectory(propType) {
  const appDirectory = MachineHelper.apps
    .map(app => {
      if (app.cmd === process.cwd()) {
        return app[propType]
      }
    })
    .filter(Boolean)

  return appDirectory.length ? appDirectory : undefined
}

// Sets default value for propType that is stored in a directory to propValue.
// Replaces saveAppForDirectory
// Saves the app directory into local storage
function savePropForDirectory(propType, propValue) {
  const apps = MachineHelper.apps

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i]

    if (app.cwd === process.cwd()) {
      app[propType] = propValue

      MachineHelper.setApps(apps)

      return
    }
  }

  const newApp = {
    cwd: process.cwd(),
    [propType]: propValue
  }

  apps.push(newApp)

  MachineHelper.setApps(apps)
}

function getDefaultMachine() {
  const machine = getPropForDirectory(MACHINE_TO_DEPLOY)

  if (machine) return machine.name

  if (MachineHelper.machines.length == 2) return 1

  return EMPTY_STRING
}

function deploy(options) {
  if (!isTarFileProvided(options.tarFile)) {
    validateIsGitRepository()

    validateDefinitionFile()
  }

  console.log("Preparing deployment to Captain...\n")

  const questions = [
    {
      type: "list",
      name: "captainNameToDeploy",
      default: getDefaultMachine(),
      message: "Select the Captain Machine you want to deploy to:",
      choices: MachineHelper.getMachinesAsOptions(),
      when: () => optionIsGiven(options, "host")
    },
    {
      type: "input",
      default: getPropForDirectory(DEFAULT_BRANCH_TO_PUSH) || "master",
      name: "branchToPush",
      message: "Enter the 'git' branch you would like to deploy:",
      when: () => optionIsGiven(options, "branch")
    },
    {
      type: "input",
      default: getPropForDirectory(DEFAULT_APP_NAME),
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
  // TODO - Refactor
  let defaultInvalid = false

  if (options.default) {
    if (
      !getDefaultMachine() ||
      !getPropForDirectory(options.branch || DEFAULT_BRANCH_TO_PUSH) ||
      !getPropForDirectory(DEFAULT_APP_NAME)
    ) {
      printError("Default deploy failed. Please select deploy options.")

      defaultInvalid = true
    } else {
      printMessage(
        `Deploying to ${getPropForDirectory(MACHINE_TO_DEPLOY).name}`
      )

      deployTo(
        getPropForDirectory(MACHINE_TO_DEPLOY),
        getPropForDirectory(DEFAULT_BRANCH_TO_PUSH),
        getPropForDirectory(DEFAULT_APP_NAME)
      )
    }
  }

  // TODO - Refactor
  const isStateless =
    options.stateless && options.host && options.appName && options.pass

  if (isStateless) {
    // login first
    printMessage(`Trying to login to ${options.host}\n`)

    printMessage(
      `Starting stateless deploy to\n${options.host}\n${options.branch}\n${
        options.appName
      }`
    )

    deployTo()
  } else if (!options.default || defaultInvalid) {
    inquirer.prompt(questions).then(answers => {
      if (!answers.confirmedToDeploy) {
        printMessage("\nOperation cancelled by the user...\n")

        process.exit(0)
      }

      const captainNameToDeploy = answers.captainNameToDeploy
      const branchToPush = answers.branchToPush || options.branch
      const appName = answers.appName || options.appName

      DeployApi.setMachineToDeploy(captainNameToDeploy || options.host)

      DeployApi.setBranchToPush(branchToPush)

      DeployApi.setAppName(appName)

      printMessage(`Deploying to ${DeployApi.machineToDeploy.name}`)

      deployTo()
    })
  }

  async function deployTo() {
    // 1. Check if valid auth
    const isAuthenticated = await DeployApi.isAuthTokenValid()

    // 2. Request login
    // 3. Login
    // 4. Update token
    if (!isAuthenticated) {
      requestLogin()
    }

    // Send from tar file
    if (isTarFileProvided(options.tarFile)) {
      const filePath = options.tarFile
      const fileStream = getFileStream(filePath)
      const gitHash = "sendviatarfile"

      uploadFile(filePath, fileStream, gitHash)

      return
    }

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
}

module.exports = deploy
