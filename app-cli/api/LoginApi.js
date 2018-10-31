const MainApi = require("./MainApi")

class LoginApi {
  loginMachine(url, password) {
    try {
      return MainApi.post(url, { password })
    } catch (e) {
      throw e
    }
  }
}

module.exports = new LoginApi()
