const chalk = require("chalk")
const MachineHelper = require("../helpers/MachineHelper")
const { printMessage } = require("../utils/messageHandler")

function _displayMachine(machine) {
  console.log(
    ">> " +
      chalk.greenBright(machine.name) +
      " at " +
      chalk.cyan(machine.baseUrl)
  )
}

function list() {
  printMessage("\nLogged in Captain Machines:\n")

  MachineHelper.machines.map(machine => {
    _displayMachine(machine)
  })

  printMessage("")
}

module.exports = list
