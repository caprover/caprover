var ApiStatusCode = require('./ApiStatusCodes');
var BaseApi = /** @class */ (function () {
    function BaseApi(status, description) {
        this.status = status;
        this.description = description;
    }
    return BaseApi;
}());
module.exports = BaseApi;
