"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const StorageHelper_1 = require("./StorageHelper");
class CliHelper {
    static get() {
        if (!CliHelper.instance)
            CliHelper.instance = new CliHelper();
        return CliHelper.instance;
    }
    findDefaultCaptainName() {
        let currentSuffix = StorageHelper_1.default.get().getMachines().length + 1;
        const self = this;
        while (!self.isSuffixValid(currentSuffix)) {
            currentSuffix++;
        }
        return self.getCaptainFullName(currentSuffix);
    }
    getCaptainFullName(suffix) {
        const formatSuffix = suffix < 10 ? `0${suffix}` : suffix;
        return `captain-${formatSuffix}`;
    }
    isSuffixValid(suffixNumber) {
        const self = this;
        let valid = true;
        StorageHelper_1.default.get().getMachines().map((machine) => {
            if (machine.name === self.getCaptainFullName(suffixNumber)) {
                valid = false;
            }
        });
        return valid;
    }
}
exports.default = CliHelper;
//# sourceMappingURL=CliHelper.js.map