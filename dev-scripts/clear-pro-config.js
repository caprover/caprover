/*jshint esversion: 6 */

const fs = require('fs-extra')
const CONFIG_FILE_PATH = '/captain/data/config-captain.json'

const fileContent = JSON.parse(
    fs.readFileSync(CONFIG_FILE_PATH, {
        encoding: 'utf-8',
    })
)

fs.writeFileSync(CONFIG_FILE_PATH + '.backup', JSON.stringify(fileContent))

fileContent.pro = {}

fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify(fileContent))
