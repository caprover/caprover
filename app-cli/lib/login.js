const MachineHelper = require("../helpers/MachineHelper")
const {
  printMessage,
  printGreenMessage,
  printError
} = require("../utils/messageHandler")
const inquirer = require("inquirer")
const { cleanUpUrl, findDefaultCaptainName } = require("../utils/loginHelpers")
const { SAMPLE_DOMAIN } = require("../utils/constants")
const LoginApi = require("../api/LoginApi")

// In case the token is expired
function requestLogin() {
  const { baseUrl, name } = this.machineToDeploy

  printMessage("Your auth token is not valid anymore. Try to login again.")

  const questions = [
    {
      type: "password",
      name: "captainPassword",
      message: "Please enter your password for " + baseUrl,
      validate: function(value) {
        if (value && value.trim()) {
          return true
        }

        return "Please enter your password for " + baseUrl
      }
    }
  ]

  inquirer.prompt(questions).then(async passwordAnswers => {
    const password = passwordAnswers.captainPassword
    const response = await LoginApi.loginMachine(baseUrl, password)
    const data = JSON.parse(response)
    const newToken = data.token

    // Update the token to the machine that corresponds
    MachineHelper.updateMachineAuthToken(name, newToken)
  })
}

function login() {
  printMessage("Login to a Captain Machine")

  const questions = [
    {
      type: "input",
      default: SAMPLE_DOMAIN,
      name: "captainAddress",
      message:
        "\nEnter address of the Captain machine. \nIt is captain.[your-captain-root-domain] :",
      validate: value => {
        if (value === SAMPLE_DOMAIN) {
          return "Enter a valid URL"
        }

        if (!cleanUpUrl(value)) return "This is an invalid URL: " + value

        MachineHelper.machines.map(machine => {
          if (cleanUpUrl(machine.baseUrl) === cleanUpUrl(value)) {
            return `${value} already exist as ${
              machine.name
            }. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`
          }
        })

        if (value && value.trim()) {
          return true
        }

        return "Please enter a valid address."
      }
    },
    {
      type: "confirm",
      name: "captainHasRootSsl",
      message: "Is HTTPS activated for this Captain machine?",
      default: true
    },
    {
      type: "password",
      name: "captainPassword",
      message: "Enter your password:",
      validate: value => {
        if (value && value.trim()) {
          return true
        }

        return "Please enter your password."
      }
    },
    {
      type: "input",
      name: "captainName",
      message: "Enter a name for this Captain machine:",
      default: findDefaultCaptainName(),
      validate: value => {
        MachineHelper.machines.map(machine => {
          if (machine.name === value) {
            return `${value} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`
          }
        })

        if (value.match(/^[-\d\w]+$/i)) {
          return true
        }

        return "Please enter a Captain Name."
      }
    }
  ]

  inquirer.prompt(questions).then(async answers => {
    const {
      captainHasRootSsl,
      captainPassword,
      captainAddress,
      captainName
    } = answers
    const handleHttp = captainHasRootSsl ? "https://" : "http://"
    const baseUrl = `${handleHttp}${cleanUpUrl(captainAddress)}`

    try {
      const data = await LoginApi.loginMachine(baseUrl, captainPassword)
      const response = JSON.parse(data)

      // TODO - This status should be 200 maybe?
      if (response.status !== 100) {
        throw new Error(JSON.stringify(response, null, 2))
      }

      const newMachine = {
        authToken: response.token,
        baseUrl,
        name: captainName
      }

      MachineHelper.addMachine(newMachine)

      printGreenMessage(`Logged in successfully to ${baseUrl}`)

      printGreenMessage(`Authorization token is now saved as ${captainName} \n`)
    } catch (error) {
      const errorMessage = error.message ? error.message : error

      printError(
        `Something bad happened. Cannot save "${captainName}" \n${errorMessage}`
      )
    }
  })
}

module.exports = login

module.exports = requestLogin
