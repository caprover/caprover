const DeployApi = require("../api/DeployApi")
const MachineHelper = require("../helpers/MachineHelper")

function initMachineFromLocalStorage() {
  const possibleApp = MachineHelper.apps.find(app => app.cwd === process.cwd())

  if (possibleApp) {
    DeployApi.setMachineToDeploy(possibleApp.machineToDeploy)

    DeployApi.setAppName(possibleApp.appName)

    DeployApi.setBranchToPush(possibleApp.branchToPush)
  }
}

// Saves the app directory into local storage
function saveMachineToLocalStorage() {
  const apps = MachineHelper.apps
  const currentDirectory = process.cwd()
  let appExists = false

  // Update app
  apps.map(app => {
    if (app.cwd === currentDirectory) {
      appExists = true

      return {
        cwd: app.cwd,
        appName: DeployApi.appName,
        branchToPush: DeployApi.branchToPush,
        machineToDeploy: DeployApi.machineToDeploy
      }
    }

    return app
  })

  if (!appExists) {
    const newApp = {
      cwd: process.cwd(),
      appName: DeployApi.appName,
      branchToPush: DeployApi.branchToPush,
      machineToDeploy: DeployApi.machineToDeploy
    }

    apps.push(newApp)

    MachineHelper.setApps(apps)
  }
}

module.exports = {
  initMachineFromLocalStorage,
  saveMachineToLocalStorage
}
