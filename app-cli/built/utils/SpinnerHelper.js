"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ora = require('ora');
class SpinnerHelper {
    start(message) {
        this.spinner = ora(message).start();
    }
    setColor(color) {
        this.spinner.color = color;
    }
    stop() {
        this.spinner.stop();
    }
    succeed() {
        this.spinner.succeed();
    }
    fail() {
        this.spinner.fail();
    }
}
exports.default = new SpinnerHelper();
//# sourceMappingURL=SpinnerHelper.js.map