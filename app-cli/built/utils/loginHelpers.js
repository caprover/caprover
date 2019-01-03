var MachineHelper = require("../helpers/MachineHelper");
function cleanUpUrl(url) {
    if (!url || !url.length)
        return null;
    var cleanedUrl = url;
    var hasSlashAtTheEnd = url.substr(url.length - 1, 1) === "/";
    if (hasSlashAtTheEnd) {
        // Remove the slash at the end
        cleanedUrl = url.substr(0, url.length - 1);
    }
    return cleanedUrl
        .replace("http://", "")
        .replace("https://", "")
        .trim();
}
function findDefaultCaptainName() {
    var currentSuffix = MachineHelper.machines.length + 1;
    while (!isSuffixValid(currentSuffix)) {
        currentSuffix++;
    }
    return getCaptainFullName(currentSuffix);
}
function getCaptainFullName(suffix) {
    var formatSuffix = suffix < 10 ? "0" + suffix : suffix;
    return "captain-" + formatSuffix;
}
var isSuffixValid = function (suffixNumber) {
    return MachineHelper.machines.map(function (machine) {
        machine.name !== getCaptainFullName(suffixNumber);
    });
};
module.exports = {
    cleanUpUrl: cleanUpUrl,
    findDefaultCaptainName: findDefaultCaptainName,
    isSuffixValid: isSuffixValid,
    getCaptainFullName: getCaptainFullName
};
