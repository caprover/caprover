#!/usr/bin/env node

const packagejson = require("./package.json")
const updateNotifier = require("update-notifier")

updateNotifier({ pkg: packagejson }).notify({ isGlobal: true })

const program = require("commander")
const fs = require("fs")
const path = require("path")
const chalk = require("chalk")
// Command actions
const list = require("./lib/list")
const logout = require("./lib/logout")

// Setup
program.version(packagejson.version + "").description(packagejson.description)

program
  .command(
    "serversetup",
    "Performs necessary actions and prepares your Captain server."
  )
  .command(
    "login",
    "Login to a CaptainDuckDuck machine. You can be logged in to multiple machines simultaneously."
  )
  .command(
    "deploy",
    "Deploy your app (current directory) to a specific Captain machine. You'll be prompted to choose your Captain machine."
  )

// Commands
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

program.parse(process.argv)
