const Request = require("request-promise")

class MainApi {
  constructor() {
    this.sharedOptions = {
      headers: {
        "x-namespace": "captain"
      }
    }
  }

  _buildOptions(options) {
    if (!options) return this.sharedOptions

    if (options.headers) {
      options.headers = Object.assign(
        {},
        this.sharedOptions.headers,
        options.headers
      )
    }

    return Object.assign({}, this.sharedOptions, options)
  }

  get(url, options) {
    const overrideOptions = this._buildOptions(options)
    const optionsToSend = {
      ...overrideOptions,
      url,
      method: "GET"
    }

    return Request(optionsToSend)
  }

  post(url, form, options) {
    const overrideOptions = this._buildOptions(options)
    const optionsToSend = {
      ...overrideOptions,
      url,
      method: "POST",
      form
    }

    return Request(optionsToSend)
  }

  put(url, form, options) {
    const overrideOptions = this._buildOptions(options)
    const optionsToSend = {
      ...overrideOptions,
      url,
      method: "PUT",
      form
    }

    return Request(optionsToSend)
  }

  patch(url, form, options) {
    const overrideOptions = this._buildOptions(options)
    const optionsToSend = {
      ...overrideOptions,
      url,
      method: "PATCH",
      form
    }

    return Request(optionsToSend)
  }

  delete(url, options) {
    const overrideOptions = this._buildOptions(options)
    const optionsToSend = {
      ...overrideOptions,
      url,
      method: "DELETE"
    }

    return Request(optionsToSend)
  }
}

module.exports = new MainApi()
