const chalk = require("chalk")
const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})

function _displayMachine(machine) {
  console.log(
    ">> " +
      chalk.greenBright(machine.name) +
      " at " +
      chalk.cyan(machine.baseUrl)
  )
}

function list() {
  console.log("\nLogged in Captain Machines:\n")

  const machines = configs.get("captainMachines")

  machines.map(machine => {
    _displayMachine(machine)
  })

  console.log("")
}

module.exports = list
