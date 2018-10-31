const inquirer = require("inquirer")
const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})
const machines = configs.get("captainMachines")

function getMachineList() {
  const firstItemInOption = [
    {
      name: "-- CANCEL --",
      value: "",
      short: ""
    }
  ]
  const listOfMachines = machines.map(machine => {
    return {
      name: `${machine.name} at ${machine.baseUrl}`,
      value: `${machine.name}`,
      short: `${machine.name} at ${machine.baseUrl}`
    }
  })

  return [...firstItemInOption, ...listOfMachines]
}

function generateQuestions() {
  const listOfMachines = getMachineList()

  return [
    {
      type: "list",
      name: "captainNameToLogout",
      message: "Select the Captain Machine you want to logout from:",
      choices: listOfMachines
    },
    {
      type: "confirm",
      name: "confirmedToLogout",
      message: "Are you sure you want to logout from this Captain machine?",
      default: false,
      when: answers => !!answers.captainNameToLogout
    }
  ]
}

function removeMachineFromLocalStorage(machineName) {
  const removedMachine = machines.filter(
    machine => machine.name === machineName
  )[0]
  const newMachines = machines.filter(machine => machine.name !== machineName)

  configs.set("captainMachines", newMachines)

  console.log(
    `You are now logged out from ${removedMachine.name} at ${
      removedMachine.baseUrl
    }...\n`
  )
}

function logout() {
  const questions = generateQuestions()

  console.log("Logout from a Captain Machine and clear auth info")

  inquirer.prompt(questions).then(answers => {
    const { captainNameToLogout } = answers

    if (!captainNameToLogout) {
      console.log("\nOperation cancelled by the user...\n")

      return
    }

    removeMachineFromLocalStorage(captainNameToLogout)
  })
}

module.exports = logout
