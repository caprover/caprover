const fs = require("fs-extra")
const chalk = require("chalk")
const request = require("request")
const ProgressBar = require("progress")
const ora = require("ora")
const configstore = require("configstore")
const packagejson = require("./package.json")
const { requestLogin } = require("./utils/loginHandler")
const configs = new configstore(packagejson.name, {
  captainMachines: [],
  apps: []
})

function sendFileToCaptain(
  machineToDeploy,
  zipFileFullPath,
  appName,
  gitHash,
  branchToPush
) {
  console.log("Uploading file to " + machineToDeploy.baseUrl)

  const fileSize = fs.statSync(zipFileFullPath).size
  const fileStream = fs.createReadStream(zipFileFullPath)
  const barOpts = {
    width: 20,
    total: fileSize,
    clear: true
  }
  const bar = new ProgressBar(
    " uploading [:bar] :percent  (ETA :etas)",
    barOpts
  )

  fileStream.on("data", function(chunk) {
    bar.tick(chunk.length)
  })

  let spinner

  fileStream.on("end", function() {
    console.log(" ")

    console.log("This might take several minutes. PLEASE BE PATIENT...")

    spinner = ora("Building your source code...").start()

    spinner.color = "yellow"
  })

  const options = {
    url:
      machineToDeploy.baseUrl +
      "/api/v1/user/appData/" +
      appName +
      "/?detached=1",
    headers: {
      "x-namespace": "captain",
      "x-captain-auth": machineToDeploy.authToken
    },
    method: "POST",
    formData: {
      sourceFile: fileStream,
      gitHash: gitHash
    }
  }

  function callback(error, response, body) {
    if (spinner) {
      spinner.stop()
    }

    if (fs.pathExistsSync(zipFileFullPath) && !getSuppliedTarFile()) {
      fs.removeSync(zipFileFullPath)
    }

    try {
      if (!error && response.statusCode === 200) {
        const data = JSON.parse(body)

        if (data.status === 1106) {
          // expired token
          requestLogin(
            machineToDeploy.name,
            machineToDeploy.baseUrl,
            function callback(machineToDeployNew) {
              deployTo(machineToDeployNew, branchToPush, appName)
            }
          )

          return
        }

        if (data.status !== 100 && data.status !== 101) {
          throw new Error(JSON.stringify(data, null, 2))
        }

        savePropForDirectory(APP_NAME, appName)

        savePropForDirectory(BRANCH_TO_PUSH, branchToPush)

        savePropForDirectory(MACHINE_TO_DEPLOY, machineToDeploy)

        if (data.status === 100) {
          console.log(chalk.green("Deployed successfully: ") + appName)
          console.log(" ")
        } else if (data.status === 101) {
          console.log(chalk.green("Building started: ") + appName)
          console.log(" ")

          startFetchingBuildLogs(machineToDeploy, appName)
        }

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
        chalk.red('\nSomething bad happened. Cannot deploy "' + appName + '"\n')
      )

      if (error.message) {
        try {
          var errorObj = JSON.parse(error.message)
          if (errorObj.status) {
            console.error(chalk.red("\nError code: " + errorObj.status))
            console.error(
              chalk.red("\nError message:\n\n " + errorObj.description)
            )
          } else {
            throw new Error("NOT API ERROR")
          }
        } catch (ignoreError) {
          console.error(chalk.red(error.message))
        }
      } else {
        console.error(chalk.red(error))
      }
      console.log(" ")
    }
  }

  request(options, callback)
}

// Sets default value for propType that is stored in a directory to propValue.
// Replaces saveAppForDirectory
function savePropForDirectory(propType, propValue) {
  const apps = configs.get("apps")

  for (let i = 0; i < apps.length; i++) {
    const app = apps[i]

    if (app.cwd === process.cwd()) {
      app[propType] = propValue

      configs.set("apps", apps)

      return
    }
  }

  apps.push({
    cwd: process.cwd(),
    [propType]: propValue
  })

  configs.set("apps", apps)
}

module.exports = sendFileToCaptain
