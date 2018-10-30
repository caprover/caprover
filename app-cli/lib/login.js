const program = require("commander")
const fs = require("fs")
const path = require("path")
const chalk = require("chalk")
const inquirer = require("inquirer")
const configstore = require("configstore")
const request = require("request")
const packagejson = require("./package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})

program
  .description(
    "Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously."
  )
  .parse(process.argv)

function cleanUpUrl(url) {
  if (!url) {
    return url
  }

  url = url.trim()

  url = url.replace("http://", "").replace("https://", "")

  if (!url || !url.length) {
    return url
  }

  if (url.substr(url.length - 1, 1) === "/") {
    url = url.substr(0, url.length - 1)
  }

  return url
}

if (program.args.length) {
  console.error(chalk.red("Unrecognized commands:"))

  program.args.forEach(function(arg) {
    console.log(chalk.red(arg))
  })

  console.error(chalk.red("Login does not require any options. "))

  process.exit(1)
}

function findDefaultCaptainName() {
  const machines = configs.get("captainMachines")
  let currentSuffix = machines.length + 1

  function getCaptainFullName(suffix) {
    if (suffix < 10) {
      suffix = "0" + suffix
    }

    return "captain-" + suffix
  }

  function isSuffixValid(suffixNumber) {
    for (let i = 0; i < machines.length; i++) {
      const m = machines[i]

      if (m.name === getCaptainFullName(suffixNumber)) {
        return false
      }
    }

    return true
  }

  while (!isSuffixValid(currentSuffix)) {
    currentSuffix++
  }

  return getCaptainFullName(currentSuffix)
}

console.log("Login to a Captain Machine")

const SAMPLE_DOMAIN = "captain.captainroot.yourdomain.com"
const questions = [
  {
    type: "input",
    default: SAMPLE_DOMAIN,
    name: "captainAddress",
    message:
      "Enter address of the Captain machine. \nIt is captain.[your-captain-root-domain] :",
    validate: function(value) {
      if (value === SAMPLE_DOMAIN) {
        return "Enter a valid URL"
      }

      if (!cleanUpUrl(value)) {
        return "This is an invalid URL: " + value
      }

      const machines = configs.get("captainMachines")

      for (let i = 0; i < machines.length; i++) {
        if (cleanUpUrl(machines[i].baseUrl) === cleanUpUrl(value)) {
          return (
            value +
            " already exist as " +
            machines[i].name +
            ". If you want to replace the existing entry, you have to first use <logout> command, and then re-login."
          )
        }
      }

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
    validate: function(value) {
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
    validate: function(value) {
      const machines = configs.get("captainMachines")

      for (let i = 0; i < machines.length; i++) {
        if (machines[i].name === value) {
          return (
            value +
            " already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login."
          )
        }
      }

      if (value.match(/^[-\d\w]+$/i)) {
        return true
      }

      return "Please enter a Captain Name."
    }
  }
]

function setCaptainMachine(data) {
  const machines = configs.get("captainMachines")

  machines.push(data)

  configs.set("captainMachines", machines)
}

inquirer.prompt(questions).then(function(answers) {
  console.log("\n")

  const baseUrl =
    (answers.captainHasRootSsl ? "https://" : "http://") +
    cleanUpUrl(answers.captainAddress)
  const options = {
    url: baseUrl + "/api/v1/login",
    headers: {
      "x-namespace": "captain"
    },
    method: "POST",
    form: {
      password: answers.captainPassword
    }
  }

  function callback(error, response, body) {
    const captainNameEnterByUser = answers.captainName

    try {
      if (!error && response.statusCode === 200) {
        const data = JSON.parse(body)

        if (data.status !== 100) {
          throw new Error(JSON.stringify(data, null, 2))
        }

        console.log(chalk.green("Logged in successfully to ") + baseUrl)

        console.log(
          chalk.green(
            `Authorization token is now saved as ${captainNameEnterByUser} \n`
          )
        )

        setCaptainMachine({
          authToken: data.token,
          baseUrl: baseUrl,
          name: captainNameEnterByUser
        })

        return
      }

      if (error) {
        throw new Error(error)
      }

      throw new Error(
        response ? JSON.stringify(response, null, 2) : "Response NULL"
      )
    } catch (error) {
      console.error(
        chalk.red(
          `Something bad happened. Cannot save "${captainNameEnterByUser}"`
        )
      )

      const errorMessage = error.message ? error.message : error

      console.error(`${chalk.red(errorMessage)} \n`)
    }
  }

  request(options, callback)
})
