var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var ApiStatusCode = require('./ApiStatusCodes');
var BaseApi = require('./BaseApi');
var TokenApi = /** @class */ (function (_super) {
    __extends(TokenApi, _super);
    function TokenApi(token) {
        var _this = _super.call(this, ApiStatusCode.STATUS_OK, '') || this;
        _this.token = token;
        return _this;
    }
    return TokenApi;
}(BaseApi));
module.exports = TokenApi;
