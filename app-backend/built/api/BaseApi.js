const ApiStatusCode = require('./ApiStatusCodes');
class BaseApi {
    constructor(status, description) {
        this.status = status;
        this.description = description;
    }
}
module.exports = BaseApi;
//# sourceMappingURL=BaseApi.js.map