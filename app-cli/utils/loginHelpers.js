const MachineHelper = require("../helpers/MachineHelper")

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

function findDefaultCaptainName() {
  let currentSuffix = MachineHelper.machines.length + 1

  while (!_isSuffixValid(currentSuffix)) {
    currentSuffix++
  }

  return _getCaptainFullName(currentSuffix)
}

function _getCaptainFullName(suffix) {
  const formatSuffix = suffix < 10 ? `0${suffix}` : suffix

  return `captain-${formatSuffix}`
}

const _isSuffixValid = suffixNumber =>
  MachineHelper.machines.map(machine => {
    machine.name !== _getCaptainFullName(suffixNumber)
  })

module.exports = {
  cleanUpUrl,
  findDefaultCaptainName
}
