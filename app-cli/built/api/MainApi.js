var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var Request = require("request-promise");
var MainApi = /** @class */ (function () {
    function MainApi() {
        this.sharedOptions = {
            headers: {
                "x-namespace": "captain"
            }
        };
    }
    MainApi.prototype._buildOptions = function (options) {
        if (!options)
            return this.sharedOptions;
        if (options.headers) {
            options.headers = Object.assign({}, this.sharedOptions.headers, options.headers);
        }
        return Object.assign({}, this.sharedOptions, options);
    };
    MainApi.prototype.get = function (url, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "GET" });
        return Request(optionsToSend);
    };
    MainApi.prototype.post = function (url, form, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "POST", form: form });
        return Request(optionsToSend);
    };
    MainApi.prototype.postWithFile = function (url, formData, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "POST", formData: formData });
        return Request(optionsToSend);
    };
    MainApi.prototype.put = function (url, form, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "PUT", form: form });
        return Request(optionsToSend);
    };
    MainApi.prototype.patch = function (url, form, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "PATCH", form: form });
        return Request(optionsToSend);
    };
    MainApi.prototype.delete = function (url, options) {
        var overrideOptions = this._buildOptions(options);
        var optionsToSend = __assign({}, overrideOptions, { url: url, method: "DELETE" });
        return Request(optionsToSend);
    };
    return MainApi;
}());
module.exports = new MainApi();
