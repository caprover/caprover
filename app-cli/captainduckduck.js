#!/usr/bin/env node

const { printErrorAndExit } = require("./utils/messageHandler")
const packagejson = require("./package.json")
const updateNotifier = require("update-notifier")
const program = require("commander")

updateNotifier({ pkg: packagejson }).notify({ isGlobal: true })

// Command actions
const serversetup = require("./lib/serversetup")
const login = require("./lib/login")
const logout = require("./lib/logout")
const list = require("./lib/list")
// const deploy = require("./lib/deploy")

// Setup
program.version(packagejson.version).description(packagejson.description)

// Commands
program
  .command("serversetup")
  .description("Performs necessary actions and prepares your Captain server.")
  .action(() => {
    serversetup()
  })

program
  .command("login")
  .description(
    "Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously."
  )
  .action(() => {
    login()
  })

program
  .command("logout")
  .description("Logout from a specific Captain machine.")
  .action(() => {
    logout()
  })

program
  .command("list")
  .description("List all Captain machines currently logged in.")
  .action(() => {
    list()
  })

program
  .command("deploy")
  .description(
    "Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine."
  )
  .action(() => {
    // deploy()
  })

// Error on unknown commands
program.on("command:*", () => {
  const wrongCommands = program.args.join(" ")

  printErrorAndExit(
    `\nInvalid command: ${wrongCommands}\nSee --help for a list of available commands.\n`
  )
})

program.parse(process.argv)
