"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ErrorFactory {
    constructor() {
        this.OKAY = 100;
        this.OKAY_BUILD_STARTED = 101;
        this.STATUS_ERROR_GENERIC = 1000;
        this.STATUS_ERROR_CAPTAIN_NOT_INITIALIZED = 1001;
        this.STATUS_ERROR_USER_NOT_INITIALIZED = 1101;
        this.STATUS_ERROR_NOT_AUTHORIZED = 1102;
        this.STATUS_ERROR_ALREADY_EXIST = 1103;
        this.STATUS_ERROR_BAD_NAME = 1104;
        this.STATUS_WRONG_PASSWORD = 1105;
        this.STATUS_AUTH_TOKEN_INVALID = 1106;
        this.VERIFICATION_FAILED = 1107;
        this.UNKNOWN_ERROR = 1999;
    }
    createError(status, message) {
        let e = new Error(message);
        e.captainStatus = status;
        e.captainMessage = message;
        return e;
    }
    eatUpPromiseRejection() {
        return function (error) {
            // nom nom
        };
    }
}
exports.default = new ErrorFactory();
//# sourceMappingURL=ErrorFactory.js.map