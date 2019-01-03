const MainApi = require("./MainApi")
const LoginApi = require("./LoginApi")
// const spinnerUtil = require("../../utils/spinner")

class SystemApi {
  constructor() {
    this.ipAddressOfServer = ""

    this.customDomainFromUser = ""

    this.newPasswordFirstTry = ""
  }

  setCustomDomainFromUser(newCustomDomainFromUser) {
    this.customDomainFromUser = newCustomDomainFromUser
  }

  setIpAddressOfServer(newIpAddress) {
    this.ipAddressOfServer = newIpAddress.trim()
  }

  async setCustomDomain(baseUrl, rootDomain) {
    try {
      const customOptions = {
        headers: {
          "x-captain-auth": LoginApi.token
        }
      }
      const data = await MainApi.post(
        `${baseUrl}/api/v1/user/system/changerootdomain/`,
        {
          rootDomain
        },
        customOptions
      )

      return data
    } catch (e) {
      throw e
    }
  }

  async enableHttps(baseUrl, emailAddress) {
    const customOptions = {
      headers: {
        "x-captain-auth": LoginApi.token
      }
    }

    try {
      const data = await MainApi.post(
        `${baseUrl}/api/v1/user/system/enablessl/`,
        {
          emailAddress
        },
        customOptions
      )

      return data
    } catch (e) {
      throw e
    }
  }

  async forceHttps(baseUrl, isEnabled = true) {
    try {
      const customOptions = {
        headers: {
          "x-captain-auth": LoginApi.token
        }
      }
      const data = await MainApi.post(
        `${baseUrl}/api/v1/user/system/forcessl/`,
        {
          isEnabled
        },
        customOptions
      )

      return data
    } catch (e) {
      throw e
    }
  }
}

module.exports = new SystemApi()
