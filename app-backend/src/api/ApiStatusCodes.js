let apiStatusCode = {

    createError: function (code, message) {
        let msg = message || 'NONE';
        let error = new Error(msg);
        error.captainErrorType = code;
        error.apiMessage = msg;
        return error
    },

    STATUS_OK: 100,

    STATUS_OK_DEPLOY_STARTED: 101,

    STATUS_ERROR_GENERIC: 1000,

    STATUS_ERROR_CAPTAIN_NOT_INITIALIZED: 1001,

    STATUS_ERROR_USER_NOT_INITIALIZED: 1101,

    STATUS_ERROR_NOT_AUTHORIZED: 1102,

    STATUS_ERROR_ALREADY_EXIST: 1103,

    STATUS_ERROR_BAD_NAME: 1104,

    STATUS_WRONG_PASSWORD: 1105,

    STATUS_AUTH_TOKEN_INVALID: 1106,

    VERIFICATION_FAILED: 1107,

    ILLEGAL_OPERATION: 1108,

    BUILD_ERROR: 1109

};

module.exports = apiStatusCode;