const ApiStatusCode = require('./ApiStatusCodes');
const BaseApi = require('./BaseApi');

class TokenApi extends BaseApi {

    constructor(token) {
        super(ApiStatusCode.STATUS_OK, '');
        this.token = token;
    }
}

module.exports = TokenApi;