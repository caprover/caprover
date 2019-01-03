const ora = require("ora")

class SpinnerHelper {
  constructor() {
    this.spinner
  }

  setColor(color) {
    this.spinner.color = color
  }

  start(message) {
    this.spinner = ora(message).start()
  }

  stop() {
    this.spinner.stop()
  }

  succeed() {
    this.spinner.succeed()
  }

  fail() {
    this.spinner.fail()
  }
}

module.exports = new SpinnerHelper()
