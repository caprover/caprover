const MachineHelper = require("../helpers/MachineHelper")
const SystemApi = require("../api/SystemApi")
const LoginApi = require("../api/LoginApi")
const inquirer = require("inquirer")
const { findDefaultCaptainName } = require("../utils/loginHelpers")
const { isIpAddress } = require("../utils/validationsHandler")
const { SAMPLE_IP, DEFAULT_PASSWORD } = require("../utils/constants")
const {
  printMessage,
  printError,
  printMessageAndExit,
  errorHandler
} = require("../utils/messageHandler")
let newPasswordFirstTry = undefined
const questions = [
  {
    type: "list",
    name: "hasInstalledCaptain",
    message:
      "Have you already installed Captain on your server by running the following line:" +
      "\nmkdir /captain && docker run -p 80:80 -p 443:443 -p 3000:3000 -v /var/run/docker.sock:/var/run/docker.sock dockersaturn/captainduckduck ?",
    default: "Yes",
    choices: ["Yes", "No"],
    filter: value => {
      const answerFromUser = value.trim()

      if (answerFromUser === "Yes") return answerFromUser

      printMessage(
        "\n\nCannot start the setup process if Captain is not installed."
      )

      printMessageAndExit(
        "Please read tutorial on CaptainDuckDuck.com to learn how to install CaptainDuckDuck on a server."
      )
    }
  },
  {
    type: "input",
    default: SAMPLE_IP,
    name: "captainAddress",
    message: "Enter IP address of your captain server:",
    filter: async value => {
      const ipFromUser = value.trim()

      if (ipFromUser === SAMPLE_IP || !isIpAddress(ipFromUser)) {
        printError(`\nThis is an invalid IP Address: ${ipFromUser}`, true)
      }

      try {
        // login using captain42. and set the ipAddressToServer
        const data = await LoginApi.loginMachine(
          `http://${ipFromUser}:3000`,
          DEFAULT_PASSWORD
        )

        SystemApi.setIpAddressOfServer(ipFromUser)

        // All went well
        if (data) return ipFromUser
      } catch (e) {
        errorHandler(e)
      }
    }
  },
  {
    type: "password",
    name: "captainOriginalPassword",
    message: "Enter your current password:",
    when: () => !LoginApi.token,
    filter: async value => {
      try {
        const captainPasswordFromUser = value.trim()
        const data = await LoginApi.loginMachine(
          `http://${SystemApi.ipAddressOfServer}:3000`,
          captainPasswordFromUser
        )

        if (data) {
          SystemApi.setIpAddressOfServer(captainPasswordFromUser)

          LoginApi.setOldPassword(captainPasswordFromUser)
        }
      } catch (e) {
        errorHandler(e)
      }
    }
  },
  {
    type: "input",
    name: "captainRootDomain",
    message:
      "Enter a root domain for this Captain server. For example, enter test.yourdomain.com if you" +
      " setup your DNS to point *.test.yourdomain.com to ip address of your server" +
      ": ",
    filter: async value => {
      try {
        const captainRootDomainFromUser = value.trim()
        const data = await SystemApi.setCustomDomain(
          `http://${SystemApi.ipAddressOfServer}:3000`,
          captainRootDomainFromUser
        )

        if (data) {
          const newCustomDomainFromUser = `captain.${captainRootDomainFromUser}`

          SystemApi.setCustomDomainFromUser(newCustomDomainFromUser)

          return captainRootDomainFromUser
        }
      } catch (e) {
        errorHandler(e)
      }
    }
  },
  {
    type: "input",
    name: "emailAddress",
    message: "Enter your 'valid' email address to enable HTTPS: ",
    filter: async value => {
      try {
        const emailAddressFromUser = value.trim()
        const { customDomainFromUser } = SystemApi

        await SystemApi.enableHttps(
          `http://${customDomainFromUser}`,
          emailAddressFromUser
        )

        const data = await SystemApi.forceHttps(
          `https://${customDomainFromUser}`
        )

        if (data) return emailAddressFromUser
      } catch (e) {
        errorHandler(e)
      }
    }
  },
  {
    type: "password",
    name: "newPasswordFirstTry",
    message: "Enter a new password:",
    filter: value => {
      newPasswordFirstTry = value

      return value
    }
  },
  {
    type: "password",
    name: "newPassword",
    message: "Enter a new password:",
    filter: async value => {
      const { customDomainFromUser } = SystemApi

      try {
        const confirmPasswordValueFromUser = value
        const machineUrl = `https://${customDomainFromUser}`

        if (newPasswordFirstTry !== confirmPasswordValueFromUser) {
          printError("Passwords do not match", true)
        }

        const changePassData = await LoginApi.changePass(
          machineUrl,
          confirmPasswordValueFromUser
        )

        if (changePassData) {
          const loginData = await LoginApi.login(
            machineUrl,
            confirmPasswordValueFromUser
          )

          if (loginData) return
        }
      } catch (e) {
        printError(
          "\nIMPORTANT!! Server setup is completed by password is not changed."
        )

        printError("\nYou CANNOT use serversetup anymore. To continue:")

        printError(
          `\n- Go to https://${customDomainFromUser} login with default password and change the password in settings.`
        )

        printError(
          `\n- In terminal (here), type captainduckduck login and enter this as your root domain: ${customDomainFromUser}`,
          true
        )
      }
    }
  },
  {
    type: "input",
    name: "captainName",
    message: "Enter a name for this Captain machine:",
    default: findDefaultCaptainName(),
    validate: value => {
      const newMachineName = value.trim()

      MachineHelper.machines.map(
        machine =>
          machine.name === newMachineName &&
          `${newMachineName} already exist. If you want to replace the existing entry, you have to first use <logout> command, and then re-login.`
      )

      if (value.match(/^[-\d\w]+$/i)) {
        return true
      }

      return "Please enter a Captain Name."
    }
  }
]

async function serversetup() {
  printMessage("\nSetup your Captain server\n")

  const answers = await inquirer.prompt(questions)
  const captainAddress = `https://${SystemApi.customDomainFromUser}`
  const newMachine = {
    authToken: LoginApi.token,
    baseUrl: captainAddress,
    name: answers.captainName
  }

  MachineHelper.addMachine(newMachine)

  printMessage(`\n\nCaptain is available at ${captainAddress}`)

  printMessage(
    "\nFor more details and docs see http://www.captainduckduck.com\n\n"
  )
}

module.exports = serversetup
