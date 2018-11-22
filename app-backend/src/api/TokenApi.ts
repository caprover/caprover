import ApiStatusCode = require('./ApiStatusCodes')
import BaseApi = require('./BaseApi')

class TokenApi extends BaseApi {
    constructor(private token: string) {
        super(ApiStatusCode.STATUS_OK, '')
    }
}

export = TokenApi
