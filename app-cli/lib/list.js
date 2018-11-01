const chalk = require("chalk")
const MachineHelper = require("../helpers/MachineHelper")

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

  MachineHelper.machines.map(machine => {
    _displayMachine(machine)
  })

  console.log("")
}

module.exports = list
