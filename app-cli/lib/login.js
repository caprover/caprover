const chalk = require("chalk")
const inquirer = require("inquirer")
const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})
const machines = configs.get("captainMachines")
const { cleanUpUrl, findDefaultCaptainName } = require("../utils/loginHelpers")
const { SAMPLE_DOMAIN } = require("../utils/constants")
const LoginApi = require("../api/LoginApi")

function setCaptainMachine(newMachine) {
  const machines = configs.get("captainMachines")

  machines.push(newMachine)

  configs.set("captainMachines", machines)
}

function login() {
  console.log("Login to a Captain Machine")

  const questions = [
    {
      type: "input",
      default: SAMPLE_DOMAIN,
      name: "captainAddress",
      message:
        "Enter address of the Captain machine. \nIt is captain.[your-captain-root-domain] :",
      validate: value => {
        if (value === SAMPLE_DOMAIN) {
          return "Enter a valid URL"
        }

        if (!cleanUpUrl(value)) return "This is an invalid URL: " + value

        machines.map(machine => {
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
        machines.map(machine => {
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
    console.log("\n")

    const {
      captainHasRootSsl,
      captainPassword,
      captainAddress,
      captainName
    } = answers
    const handleHttp = captainHasRootSsl ? "https://" : "http://"
    const baseUrl = `${handleHttp}${cleanUpUrl(captainAddress)}`

    try {
      const data = await LoginApi.loginMachine(
        `${baseUrl}/api/v1/login`,
        captainPassword
      )
      const response = JSON.parse(data)

      // TODO - This status should be 200 maybe?
      if (response.status !== 100) {
        throw new Error(JSON.stringify(response, null, 2))
      }

      console.log(`${chalk.green("Logged in successfully to ")}${baseUrl}`)

      console.log(
        chalk.green(`Authorization token is now saved as ${captainName} \n`)
      )

      const newMachine = {
        authToken: response.token,
        baseUrl,
        name: captainName
      }

      setCaptainMachine(newMachine)
    } catch (error) {
      console.error(
        chalk.red(`Something bad happened. Cannot save "${captainName}"`)
      )

      const errorMessage = error.message ? error.message : error

      console.error(`${chalk.red(errorMessage)} \n`)
    }
  })
}

module.exports = login
