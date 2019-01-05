"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Logger {
    static log(s) {
        console.log(s);
    }
    static error(s) {
        console.error(s);
    }
    static dev(s) {
        if (process.env.CLI_IS_DEBUG) {
            console.log(">>> ", s);
        }
    }
}
exports.default = Logger;
//# sourceMappingURL=Logger.js.map