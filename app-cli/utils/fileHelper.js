const fs = require("fs-extra")
const {
  printMessage,
  printError,
  printGreenMessage,
  printMagentaMessage
} = require("./messageHandler")
const { exec } = require("child_process")
const ProgressBar = require("progress")
const ora = require("ora")
const DeployApi = require("../api/DeployApi")
let lastLineNumberPrinted = -10000 // we want to show all lines to begin with!

function gitArchiveFile(zipFileFullPath, branchToPush) {
  exec(
    `git archive --format tar --output "${zipFileFullPath}" ${branchToPush}`,
    (err, stdout, stderr) => {
      if (err) {
        printError(`TAR file failed\n${err}\n`)

        fs.removeSync(zipFileFullPath)

        return
      }

      exec(`git rev-parse ${branchToPush}`, (err, stdout, stderr) => {
        const gitHash = (stdout || "").trim()

        if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
          printError(
            `Cannot find hash of last commit on this branch: ${branchToPush}\n${gitHash}\n${err}\n`
          )

          return
        }

        printMessage(`Pushing last commit on ${branchToPush}: ${gitHash}`)

        // checkAuthAndSendFile(zipFileFullPath, gitHash)
      })
    }
  )
}

function onLogRetrieved(data) {
  if (data) {
    const lines = data.logs.lines
    const firstLineNumberOfLogs = data.logs.firstLineNumber
    let firstLinesToPrint = 0

    if (firstLineNumberOfLogs > lastLineNumberPrinted) {
      if (firstLineNumberOfLogs < 0) {
        // This is the very first fetch, probably firstLineNumberOfLogs is around -50
        firstLinesToPrint = -firstLineNumberOfLogs
      } else {
        printMessage("[[ TRUNCATED ]]")
      }
    } else {
      firstLinesToPrint = lastLineNumberPrinted - firstLineNumberOfLogs
    }

    lastLineNumberPrinted = firstLineNumberOfLogs + lines.length

    for (var i = firstLinesToPrint; i < lines.length; i++) {
      printMessage((lines[i] || "").trim())
    }
  }

  const { baseUrl, appName } = DeployApi.machineToDeploy

  if (data && !data.isAppBuilding) {
    if (!data.isBuildFailed) {
      const machineBaseUrl = baseUrl
        .replace("//captain.", "//" + appName + ".")
        .replace("https://", "http://")

      printGreenMessage(`Deployed successfully: ${appName}`)

      printMagentaMessage(`App is available at ${machineBaseUrl}\n`)
    } else {
      printError(`\nSomething bad happened. Cannot deploy "${appName}"\n`)
    }

    return
  }

  setTimeout(() => {
    startFetchingBuildLogs()
  }, 2000)
}

async function startFetchingBuildLogs() {
  try {
    const data = await DeployApi.fetchBuildLogs()
    const response = JSON.parse(data)

    if (response.status !== 100) {
      throw new Error(JSON.stringify(response, null, 2))
    }

    onLogRetrieved(data.data)
  } catch (error) {
    printError(`\nSomething while retrieving app build logs.. ${error}\n`)

    // onLogRetrieved() // TODO - should this be here?
  }
}

function getFileStream(zipFileFullPath) {
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

  fileStream.on("data", chunk => {
    bar.tick(chunk.length)
  })

  let spinner

  fileStream.on("end", () => {
    printMessage("This might take several minutes. PLEASE BE PATIENT...")

    // spinner = ora("Building your source code...").start()

    // spinner.color = "yellow"
  })

  return fileStream
}

async function sendFileToCaptain(fileStream, gitHash) {
  printMessage(`Uploading file to ${DeployApi.machineToDeploy.baseUrl}`)

  // try {
  const response = await DeployApi.sendFile(fileStream, gitHash)
  const data = JSON.parse(response)

  // Uncomment this to remove the file
  // if (fs.pathExistsSync(zipFileFullPath)) {
  //   if (!isTarFileProvided()) {
  //     fs.removeSync(zipFileFullPath)
  //   }
  // }

  if (data.status === 1106) {
    // // expired token

    printMessage("Expired token")
    // requestLogin(
    //   DeployApi.machineToDeploy.name,
    //   DeployApi.machineToDeploy.baseUrl,
    //   function callback(machineToDeployNew) {
    //     deployTo()
    //   }
    // )

    return
  }

  // if (data.status !== 100 && data.status !== 101) {
  //   throw new Error(JSON.stringify(data, null, 2))
  // }

  // savePropForDirectory(DEFAULT_APP_NAME, DeployApi.appName)

  // savePropForDirectory(DEFAULT_BRANCH_TO_PUSH, DeployApi.branchToPush)

  // savePropForDirectory(MACHINE_TO_DEPLOY, DeployApi.machineToDeploy)

  // if (data.status === 100) {
  //   printGreenMessage(`Deployed successfully: ${DeployApi.appName}\n`)
  // } else if (data.status === 101) {
  //   printGreenMessage(`Building started: ${DeployApi.appName}\n`)

  //   startFetchingBuildLogs()
  // }
  // } catch (e) {
  //   printError(
  //     `\nSomething bad happened. Cannot deploy "${DeployApi.appName}"\n`
  //   )

  //   errorHandler(e)
  // }
}

module.exports = { gitArchiveFile, sendFileToCaptain, getFileStream }
