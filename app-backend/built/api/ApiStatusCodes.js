"use strict";
const CaptainError_1 = require("./CaptainError");
const BaseApi = require("./BaseApi");
const Logger = require("../utils/Logger");
class ApiStatusCodes {
    static createError(code, message) {
        return new CaptainError_1.CaptainError(code, message || 'NONE');
    }
    static createCatcher(res) {
        return function (error) {
            Logger.e(error);
            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage));
                return;
            }
            res.sendStatus(500);
        };
    }
}
ApiStatusCodes.STATUS_OK_DEPLOY_STARTED = 101;
ApiStatusCodes.STATUS_ERROR_GENERIC = 1000;
ApiStatusCodes.STATUS_OK = 100;
ApiStatusCodes.STATUS_ERROR_CAPTAIN_NOT_INITIALIZED = 1001;
ApiStatusCodes.STATUS_ERROR_USER_NOT_INITIALIZED = 1101;
ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED = 1102;
ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST = 1103;
ApiStatusCodes.STATUS_ERROR_BAD_NAME = 1104;
ApiStatusCodes.STATUS_WRONG_PASSWORD = 1105;
ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID = 1106;
ApiStatusCodes.VERIFICATION_FAILED = 1107;
ApiStatusCodes.ILLEGAL_OPERATION = 1108;
ApiStatusCodes.BUILD_ERROR = 1109;
ApiStatusCodes.ILLEGAL_PARAMETER = 1110;
ApiStatusCodes.NOT_FOUND = 1111;
module.exports = ApiStatusCodes;
//# sourceMappingURL=ApiStatusCodes.js.map