const { printMessage } = require("../utils/messageHandler")
const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})

class MachineHelper {
  constructor() {
    this.machines = configs.get("captainMachines")
  }

  getMachinesAsOptions() {
    const firstItemInOption = [
      {
        name: "-- CANCEL --",
        value: "",
        short: ""
      }
    ]
    const listOfMachines = this.machines.map(machine => {
      return {
        name: `${machine.name} at ${machine.baseUrl}`,
        value: `${machine.name}`,
        short: `${machine.name} at ${machine.baseUrl}`
      }
    })

    return [...firstItemInOption, ...listOfMachines]
  }

  setMachines(machines) {
    this.machines = machines

    configs.set("captainMachines", machines)
  }

  addMachine(newMachine) {
    const tempMachines = this.machines
    const newMachines = [...tempMachines, newMachine]

    // Add to local storage
    configs.set("captainMachines", newMachines)

    this.setMachines(configs.get("captainMachines"))
  }

  logoutMachine(machineName) {
    const removedMachine = this.machines.filter(
      machine => machine.name === machineName
    )[0]
    const newMachines = this.machines.filter(
      machine => machine.name !== machineName
    )

    this.setMachines(newMachines)

    printMessage(
      `You are now logged out from ${removedMachine.name} at ${
        removedMachine.baseUrl
      }...\n`
    )
  }
}

module.exports = new MachineHelper()
