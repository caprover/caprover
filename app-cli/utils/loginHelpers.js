const configstore = require("configstore")
const packagejson = require("../package.json")
const configs = new configstore(packagejson.name, {
  captainMachines: []
})
const machines = configs.get("captainMachines")

function cleanUpUrl(url) {
  if (!url || !url.length) return null

  let cleanedUrl = url
  const hasSlashAtTheEnd = url.substr(url.length - 1, 1) === "/"

  if (hasSlashAtTheEnd) {
    // Remove the slash at the end
    cleanedUrl = url.substr(0, url.length - 1)
  }

  return cleanedUrl
    .replace("http://", "")
    .replace("https://", "")
    .trim()
}

function _getCaptainFullName(suffix) {
  const formatSuffix = suffix < 10 ? `0${suffix}` : suffix

  return `captain-${formatSuffix}`
}

const _isSuffixValid = suffixNumber =>
  machines.map(machine => {
    machine.name !== _getCaptainFullName(suffixNumber)
  })

function findDefaultCaptainName() {
  let currentSuffix = machines.length + 1

  while (!_isSuffixValid(currentSuffix)) {
    currentSuffix++
  }

  return _getCaptainFullName(currentSuffix)
}

module.exports = {
  cleanUpUrl,
  findDefaultCaptainName
}
