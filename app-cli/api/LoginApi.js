const MainApi = require("./MainApi")
const SystemApi = require("./SystemApi")
const { DEFAULT_PASSWORD } = require("../utils/constants")

class LoginApi {
  constructor() {
    this.token = ""

    this.oldPassword = DEFAULT_PASSWORD
  }

  setOldPassword(newPassword) {
    this.oldPassword = newPassword
  }

  setToken(newToken) {
    this.token = newToken
  }

  async loginMachine(baseUrl, password) {
    try {
      const data = await MainApi.post(`${baseUrl}/api/v1/login`, { password })
      const dataAsObject = JSON.parse(data)

      if (dataAsObject) {
        this.setToken(dataAsObject.token)
      }

      return data
    } catch (e) {
      throw e
    }
  }

  async changePass(baseUrl, newPassword) {
    try {
      const customOptions = {
        headers: {
          "x-captain-auth": LoginApi.token
        }
      }
      const form = {
        oldPassword: this.oldPassword,
        newPassword
      }
      const data = await MainApi.post(
        `${baseUrl}/api/v1/user/changepassword/`,
        form,
        customOptions
      )

      this.setToken(data.token)

      SystemApi.setIpAddressOfServer(baseUrl)

      return data
    } catch (e) {
      throw e
    }
  }
}

module.exports = new LoginApi()
