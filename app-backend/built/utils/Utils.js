"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Utils {
    static removeHttpHttps(input) {
        input = input.trim();
        input = input.replace(/^(?:http?:\/\/)?/i, '');
        input = input.replace(/^(?:https?:\/\/)?/i, '');
        return input;
    }
}
exports.default = Utils;
//# sourceMappingURL=Utils.js.map