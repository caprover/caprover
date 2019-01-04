"use strict";
const MachineHelper_1 = require("../helpers/MachineHelper");
function cleanUpUrl(url) {
    if (!url || !url.length)
        return null;
    let cleanedUrl = url;
    const hasSlashAtTheEnd = url.substr(url.length - 1, 1) === '/';
    if (hasSlashAtTheEnd) {
        // Remove the slash at the end
        cleanedUrl = url.substr(0, url.length - 1);
    }
    return cleanedUrl.replace('http://', '').replace('https://', '').trim();
}
function findDefaultCaptainName() {
    let currentSuffix = MachineHelper_1.default.getMachines().length + 1;
    while (!isSuffixValid(currentSuffix)) {
        currentSuffix++;
    }
    return getCaptainFullName(currentSuffix);
}
function getCaptainFullName(suffix) {
    const formatSuffix = suffix < 10 ? `0${suffix}` : suffix;
    return `captain-${formatSuffix}`;
}
const isSuffixValid = (suffixNumber) => MachineHelper_1.default.getMachines().map((machine) => {
    machine.name !== getCaptainFullName(suffixNumber);
});
module.exports = {
    cleanUpUrl,
    findDefaultCaptainName,
    isSuffixValid,
    getCaptainFullName
};
//# sourceMappingURL=loginHelpers.js.map