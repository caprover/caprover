var ora = require("ora");
var SpinnerHelper = /** @class */ (function () {
    function SpinnerHelper() {
        this.spinner;
    }
    SpinnerHelper.prototype.setColor = function (color) {
        this.spinner.color = color;
    };
    SpinnerHelper.prototype.start = function (message) {
        this.spinner = ora(message).start();
    };
    SpinnerHelper.prototype.stop = function () {
        this.spinner.stop();
    };
    SpinnerHelper.prototype.succeed = function () {
        this.spinner.succeed();
    };
    SpinnerHelper.prototype.fail = function () {
        this.spinner.fail();
    };
    return SpinnerHelper;
}());
module.exports = new SpinnerHelper();
