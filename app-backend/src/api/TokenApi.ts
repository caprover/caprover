import ApiStatusCodes = require('./ApiStatusCodes')
import BaseApi = require('./BaseApi')

class TokenApi extends BaseApi {
    constructor(private token: string) {
        super(ApiStatusCodes.STATUS_OK, '')
    }
}

export = TokenApi
