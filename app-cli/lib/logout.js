const MachineHelper = require("../helpers/MachineHelper")
const { printMessage } = require("../utils/messageHandler")
const inquirer = require("inquirer")

function generateQuestions() {
  const listOfMachines = MachineHelper.getMachinesAsOptions()

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

function logout() {
  const questions = generateQuestions()

  printMessage("Logout from a Captain Machine and clear auth info")

  inquirer.prompt(questions).then(answers => {
    const { captainNameToLogout } = answers

    if (!captainNameToLogout) {
      printMessage("\nOperation cancelled by the user...\n")

      return
    }

    MachineHelper.logoutMachine(captainNameToLogout)
  })
}

module.exports = logout
