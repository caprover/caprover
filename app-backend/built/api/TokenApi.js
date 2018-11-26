"use strict";
const ApiStatusCodes = require("./ApiStatusCodes");
const BaseApi = require("./BaseApi");
class TokenApi extends BaseApi {
    constructor(token) {
        super(ApiStatusCodes.STATUS_OK, '');
        this.token = token;
    }
}
module.exports = TokenApi;
//# sourceMappingURL=TokenApi.js.map