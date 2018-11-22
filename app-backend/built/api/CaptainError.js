"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class CaptainError extends Error {
    constructor(code, msg) {
        super(msg);
        this.captainErrorType = code;
    }
}
exports.CaptainError = CaptainError;
//# sourceMappingURL=CaptainError.js.map