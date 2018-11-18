const MainApi = require("./MainApi")
const MachineHelper = require("../helpers/MachineHelper")
const {
  DEFAULT_BRANCH_TO_PUSH,
  DEFAULT_APP_NAME
} = require("../utils/constants")

class DeployApi {
  constructor() {
    this.machineToDeploy = {}

    this.branchToPush = DEFAULT_BRANCH_TO_PUSH

    this.appName = DEFAULT_APP_NAME

    this.appUrl = ""
  }

  setMachineToDeploy(machineToDeploy) {
    let temp = []

    // Look machine by host
    if (machineToDeploy.startsWith("http")) {
      temp = MachineHelper.machines.find(
        machine => machine.baseUrl === machineToDeploy
      )
    } else {
      // Look machine by name
      temp = MachineHelper.machines.find(
        machine => machine.name === machineToDeploy
      )
    }

    this.machineToDeploy = temp
  }

  setBranchToPush(branchToPush) {
    this.branchToPush = branchToPush
  }

  setAppName(appName) {
    this.appName = appName

    this.setAppUrl()
  }

  setAppUrl() {
    this.appUrl = this.machineToDeploy.baseUrl
      .replace("//captain.", "//" + this.appName + ".")
      .replace("https://", "http://")
  }

  async fetchBuildLogs() {
    try {
      const { authToken, baseUrl } = this.machineToDeploy
      const customOptions = {
        headers: {
          "x-captain-auth": authToken
        }
      }
      const data = await MainApi.get(
        `${baseUrl}/api/v1/user/appData/${this.appName}`,
        customOptions
      )

      return data
    } catch (e) {
      throw e
    }
  }

  async sendFile(sourceFile, gitHash) {
    try {
      const { authToken, baseUrl } = this.machineToDeploy
      const url = `${baseUrl}/api/v1/user/appData/${this.appName}/?detached=1`
      const form = {
        sourceFile,
        gitHash
      }
      const options = {
        headers: {
          "x-captain-auth": authToken
        }
      }
      const data = await MainApi.postWithFile(url, form, options)

      return data
    } catch (e) {
      throw e
    }
  }

  // This is not moved to LoginAPI since it's related only for machineToDeploy
  async isAuthTokenValid() {
    try {
      const url = `${this.machineToDeploy.baseUrl}/api/v1/user/appDefinitions/`
      const currentToken = this.machineToDeploy.authToken
      const options = {
        headers: {
          "x-captain-auth": currentToken
        }
      }
      const response = await MainApi.get(url, options)
      const data = JSON.parse(response)

      // Tolken is not valid
      if (data.status === 1106 || data.status === 1105) {
        return false
      }

      return true
    } catch (e) {
      throw e
    }
  }
}

module.exports = new DeployApi()
