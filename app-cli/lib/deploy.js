#!/usr/bin/env node
const program = require("commander")
const fs = require("fs-extra")
const path = require("path")
const chalk = require("chalk")
const inquirer = require("inquirer")
const configstore = require("configstore")
const request = require("request")
const commandExistsSync = require("command-exists").sync
const { exec } = require("child_process")
const { sendFileToCaptain } = require("./utils/fileHandler")
const {
  requestLogin,
  requestLoginAuth,
  isAuthTokenValid
} = require("./utils/loginHandler")
const {
  validateIsGitRepository,
  validateDefinitionFile
} = require("./utils/validationsHandler")
const { printErrorAndExit } = require("./utils/errorHandler")
const packagejson = require("./package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: [],
  apps: []
})
const BRANCH_TO_PUSH = "branchToPush"
const APP_NAME = "appName"
const MACHINE_TO_DEPLOY = "machineToDeploy"
const EMPTY_STRING = ""

console.log("\n")

program
  .description("Deploy current directory to a Captain machine.")
  .option(
    "-t, --tarFile <value>",
    "Specify file to be uploaded (rather than using git archive)"
  )
  .option("-d, --default", "Run with default options")
  .option("-s, --stateless", "Run deploy stateless")
  .option(
    "-h, --host <value>",
    "Only for stateless mode: Host of the captain machine"
  )
  .option("-a, --appName <value>", "Only for stateless mode: Name of the app")
  .option("-p, --pass <value>", "Only for stateless mode: Password for Captain")
  .option(
    "-b, --branch <value>",
    "Only for stateless mode: Branch name (default master)"
  )
  .parse(process.argv)

if (program.args.length) {
  console.error(chalk.red("Unrecognized commands:"))
  program.args.forEach(function(arg) {
    console.log(chalk.red(arg))
  })
  console.error(chalk.red("Deploy does not require any options. "))
  process.exit(1)
}

function getSuppliedTarFile() {
  return program.tarFile
}

if (!getSuppliedTarFile()) {
  validateIsGitRepository()

  validateDefinitionFile()

  const contents = fs.readFileSync("./captain-definition", "utf8")
  let contentsJson = null

  try {
    contentsJson = JSON.parse(contents)
  } catch (e) {
    console.log(e)
    console.log("")
    printErrorAndExit(
      "**** ERROR: captain-definition file is not a valid JSON! ****"
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

let listOfMachines = [
  {
    name: "-- CANCEL --",
    value: EMPTY_STRING,
    short: EMPTY_STRING
  }
]

let machines = configs.get("captainMachines")
for (let i = 0; i < machines.length; i++) {
  let m = machines[i]
  listOfMachines.push({
    name: m.name + " at " + m.baseUrl,
    value: m.name,
    short: m.name + " at " + m.baseUrl
  })
}

// Gets default value for propType that is stored in a directory.
// Replaces getAppForDirectory
function getPropForDirectory(propType) {
  let apps = configs.get("apps")
  for (let i = 0; i < apps.length; i++) {
    let app = apps[i]
    if (app.cwd === process.cwd()) {
      return app[propType]
    }
  }
  return undefined
}

function getDefaultMachine() {
  let machine = getPropForDirectory(MACHINE_TO_DEPLOY)
  if (machine) {
    return machine.name
  }
  if (listOfMachines.length == 2) {
    return 1
  }
  return EMPTY_STRING
}

console.log("Preparing deployment to Captain...\n")

const questions = [
  {
    type: "list",
    name: "captainNameToDeploy",
    default: getDefaultMachine(),
    message: "Select the Captain Machine you want to deploy to:",
    choices: listOfMachines
  },
  {
    type: "input",
    default: getPropForDirectory(BRANCH_TO_PUSH) || "master",
    name: BRANCH_TO_PUSH,
    message: "Enter the 'git' branch you would like to deploy:",
    when: function(answers) {
      return !!answers.captainNameToDeploy
    }
  },
  {
    type: "input",
    default: getPropForDirectory(APP_NAME),
    name: APP_NAME,
    message: "Enter the Captain app name this directory will be deployed to:",
    when: function(answers) {
      return !!answers.captainNameToDeploy
    }
  },
  {
    type: "confirm",
    name: "confirmedToDeploy",
    message:
      "Note that uncommitted files and files in gitignore (if any) will not be pushed to server. Please confirm so that deployment process can start.",
    default: true,
    when: function(answers) {
      return !!answers.captainNameToDeploy
    }
  }
]

let defaultInvalid = false

if (program.default) {
  if (
    !getDefaultMachine() ||
    !getPropForDirectory(BRANCH_TO_PUSH) ||
    !getPropForDirectory(APP_NAME)
  ) {
    console.log("Default deploy failed. Please select deploy options.")
    defaultInvalid = true
  } else {
    console.log("Deploying to " + getPropForDirectory(MACHINE_TO_DEPLOY).name)
    deployTo(
      getPropForDirectory(MACHINE_TO_DEPLOY),
      getPropForDirectory(BRANCH_TO_PUSH),
      getPropForDirectory(APP_NAME)
    )
  }
}

const isStateless =
  program.stateless && program.host && program.appName && program.pass

if (isStateless) {
  // login first
  console.log("Trying to login to", program.host)
  requestLoginAuth(program.host, program.pass, function(authToken) {
    // deploy
    console.log(
      "Starting stateless deploy to",
      program.host,
      program.branch,
      program.appName
    )
    deployTo(
      {
        baseUrl: program.host,
        authToken
      },
      program.branch || "master",
      program.appName
    )
  })
} else if (!program.default || defaultInvalid) {
  inquirer.prompt(questions).then(function(answers) {
    console.log(" ")
    console.log(" ")

    if (!answers.confirmedToDeploy) {
      console.log("Operation cancelled by the user...")
      console.log(" ")
    } else {
      let machines = configs.get("captainMachines")
      let machineToDeploy = null
      for (let i = 0; i < machines.length; i++) {
        if (machines[i].name === answers.captainNameToDeploy) {
          console.log("Deploying to " + answers.captainNameToDeploy)
          machineToDeploy = machines[i]
          break
        }
      }

      console.log(" ")
      deployTo(machineToDeploy, answers.branchToPush, answers.appName)
    }
  })
}

function deployTo(machineToDeploy, branchToPush, appName) {
  function checkAuthAndSendFile(zipFileFullPath, gitHash) {
    function isAuthTokenValidCallback(isValid) {
      if (isValid) {
        sendFileToCaptain(
          machineToDeploy,
          zipFileFullPath,
          appName,
          gitHash,
          branchToPush
        )
      } else {
        requestLogin(
          machineToDeploy.name,
          machineToDeploy.baseUrl,
          function callback(machineToDeployNew) {
            deployTo(machineToDeployNew, branchToPush, appName)
          }
        )
      }
    }

    isAuthTokenValid(machineToDeploy, appName, isAuthTokenValidCallback)
  }

  if (getSuppliedTarFile()) {
    checkAuthAndSendFile(
      path.join(process.cwd(), getSuppliedTarFile()),
      "sendviatarfile"
    )
    return
  }

  if (!commandExistsSync("git")) {
    console.log(chalk.red('"git" command not found...'))
    console.log(
      chalk.red(
        'Captain needs "git" to create tar file of your source files...'
      )
    )
    console.log(" ")
    process.exit(1)
  }

  let zipFileNameToDeploy = "temporary-captain-to-deploy.tar"
  let zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy)

  console.log("Saving tar file to:")
  console.log(zipFileFullPath)
  console.log(" ")

  try {
    fs.removeSync(zipFileFullPath)
  } catch (ignoreError) {}

  exec(
    'git archive --format tar --output "' +
      zipFileFullPath +
      '" ' +
      branchToPush,
    function(err, stdout, stderr) {
      if (err) {
        console.log(chalk.red("TAR file failed"))
        console.log(chalk.red(err + " "))
        console.log(" ")
        fs.removeSync(zipFileFullPath)
        return
      }

      exec("git rev-parse " + branchToPush, function(err, stdout, stderr) {
        const gitHash = (stdout || "").trim()

        if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
          console.log(
            chalk.red(
              "Cannot find hash of last commit on this branch: " + branchToPush
            )
          )
          console.log(chalk.red(gitHash + " "))
          console.log(chalk.red(err + " "))
          console.log(" ")
          return
        }

        console.log("Pushing last commit on " + branchToPush + ": " + gitHash)

        checkAuthAndSendFile(zipFileFullPath, gitHash)
      })
    }
  )
}

var lastLineNumberPrinted = -10000 // we want to show all lines to begin with!

function startFetchingBuildLogs(machineToDeploy, appName) {
  let options = {
    url: machineToDeploy.baseUrl + "/api/v1/user/appData/" + appName,
    headers: {
      "x-namespace": "captain",
      "x-captain-auth": machineToDeploy.authToken
    },
    method: "GET"
  }

  function onLogRetrieved(data) {
    if (data) {
      var lines = data.logs.lines
      var firstLineNumberOfLogs = data.logs.firstLineNumber
      var firstLinesToPrint = 0
      if (firstLineNumberOfLogs > lastLineNumberPrinted) {
        if (firstLineNumberOfLogs < 0) {
          // This is the very first fetch, probably firstLineNumberOfLogs is around -50
          firstLinesToPrint = -firstLineNumberOfLogs
        } else {
          console.log("[[ TRUNCATED ]]")
        }
      } else {
        firstLinesToPrint = lastLineNumberPrinted - firstLineNumberOfLogs
      }

      lastLineNumberPrinted = firstLineNumberOfLogs + lines.length

      for (var i = firstLinesToPrint; i < lines.length; i++) {
        console.log((lines[i] || "").trim())
      }
    }

    if (data && !data.isAppBuilding) {
      console.log(" ")
      if (!data.isBuildFailed) {
        console.log(chalk.green("Deployed successfully: ") + appName)
        console.log(
          chalk.magenta("App is available at ") +
            machineToDeploy.baseUrl
              .replace("//captain.", "//" + appName + ".")
              .replace("https://", "http://")
        )
      } else {
        console.error(
          chalk.red(
            '\nSomething bad happened. Cannot deploy "' + appName + '"\n'
          )
        )
      }
      console.log(" ")
      return
    }

    setTimeout(function() {
      startFetchingBuildLogs(machineToDeploy, appName)
    }, 2000)
  }

  function callback(error, response, body) {
    try {
      if (!error && response.statusCode === 200) {
        let data = JSON.parse(body)

        if (data.status !== 100) {
          throw new Error(JSON.stringify(data, null, 2))
        }

        onLogRetrieved(data.data)

        return
      }

      if (error) {
        throw new Error(error)
      }

      throw new Error(
        response ? JSON.stringify(response, null, 2) : "Response NULL"
      )
    } catch (error) {
      console.error(
        chalk.red(
          '\nSomething while retrieving app build logs.. "' + error + '"\n'
        )
      )

      onLogRetrieved(null)
    }
  }

  request(options, callback)
}
