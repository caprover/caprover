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
module.exports = ApiStatusCodes;
//# sourceMappingURL=ApiStatusCodes.js.map