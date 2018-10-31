const Request = require("request-promise")

class MainApi {
  get(url, config) {
    return Request.get(url)
  }

  post(url, form, config) {
    const options = {
      url,
      headers: {
        "x-namespace": "captain"
      },
      method: "POST",
      form
    }

    return Request(options)
  }

  put(url, data, config) {
    return Request.put(url, data)
  }

  patch(url, data, config) {
    return Request.patch(url, data)
  }

  delete(url, data, config) {
    return Request.delete(url)
  }
}

module.exports = new MainApi()
