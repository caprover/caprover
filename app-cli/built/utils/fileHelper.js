var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var fs = require("fs-extra");
var _a = require("./messageHandler"), printMessage = _a.printMessage, printError = _a.printError, printGreenMessage = _a.printGreenMessage, printMagentaMessage = _a.printMagentaMessage;
var SpinnerHelper = require("../helpers/SpinnerHelper");
var exec = require("child_process").exec;
var ProgressBar = require("progress");
var DeployApi = require("../api/DeployApi");
var saveMachineToLocalStorage = require("../utils/machineUtils").saveMachineToLocalStorage;
var lastLineNumberPrinted = -10000; // we want to show all lines to begin with!
function gitArchiveFile(zipFileFullPath, branchToPush) {
    exec("git archive --format tar --output \"" + zipFileFullPath + "\" " + branchToPush, function (err, stdout, stderr) {
        if (err) {
            printError("TAR file failed\n" + err + "\n");
            fs.removeSync(zipFileFullPath);
            return;
        }
        exec("git rev-parse " + branchToPush, function (err, stdout, stderr) {
            var gitHash = (stdout || "").trim();
            if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
                printError("Cannot find hash of last commit on this branch: " + branchToPush + "\n" + gitHash + "\n" + err + "\n");
                return;
            }
            printMessage("Pushing last commit on " + branchToPush + ": " + gitHash);
            uploadFile(zipFileFullPath, gitHash);
        });
    });
}
function onLogRetrieved(data) {
    if (data) {
        var lines = data.logs.lines;
        var firstLineNumberOfLogs = data.logs.firstLineNumber;
        var firstLinesToPrint = 0;
        if (firstLineNumberOfLogs > lastLineNumberPrinted) {
            if (firstLineNumberOfLogs < 0) {
                // This is the very first fetch, probably firstLineNumberOfLogs is around -50
                firstLinesToPrint = -firstLineNumberOfLogs;
            }
            else {
                printMessage("[[ TRUNCATED ]]");
            }
        }
        else {
            firstLinesToPrint = lastLineNumberPrinted - firstLineNumberOfLogs;
        }
        lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;
        for (var i = firstLinesToPrint; i < lines.length; i++) {
            printMessage((lines[i] || "").trim());
        }
    }
    var finishedBuilding = data && !data.isAppBuilding;
    if (finishedBuilding) {
        if (!data.isBuildFailed) {
            printGreenMessage("Deployed successfully: " + DeployApi.appName);
            printMagentaMessage("App is available at " + DeployApi.appUrl + "\n", true);
        }
        else {
            printError("\nSomething bad happened. Cannot deploy \"" + DeployApi.appName + "\"\n", true);
        }
    }
    setTimeout(function () {
        startFetchingBuildLogs();
    }, 2000);
}
function startFetchingBuildLogs() {
    return __awaiter(this, void 0, void 0, function () {
        var data, response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, DeployApi.fetchBuildLogs()];
                case 1:
                    data = _a.sent();
                    response = JSON.parse(data);
                    if (response.status !== 100) {
                        throw new Error(JSON.stringify(response, null, 2));
                    }
                    onLogRetrieved(response.data);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    printError("\nSomething while retrieving app build logs.. " + error_1 + "\n");
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function getFileStream(zipFileFullPath) {
    var fileSize = fs.statSync(zipFileFullPath).size;
    var fileStream = fs.createReadStream(zipFileFullPath);
    var barOpts = {
        width: 20,
        total: fileSize,
        clear: true
    };
    var bar = new ProgressBar(" uploading [:bar] :percent  (ETA :etas)", barOpts);
    fileStream.on("data", function (chunk) {
        bar.tick(chunk.length);
    });
    fileStream.on("end", function () {
        printMessage("This might take several minutes. PLEASE BE PATIENT...");
        SpinnerHelper.start("Building your source code...");
        SpinnerHelper.setColor("yellow");
    });
    return fileStream;
}
function uploadFile(filePath, gitHash) {
    return __awaiter(this, void 0, void 0, function () {
        var fileStream, response, data, somethingWentWrong, isDeployedAndBuilding, isDeployedSuccessfully, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    printMessage("Uploading file to " + DeployApi.machineToDeploy.baseUrl);
                    fileStream = getFileStream(filePath);
                    return [4 /*yield*/, DeployApi.sendFile(fileStream, gitHash)];
                case 1:
                    response = _a.sent();
                    data = JSON.parse(response);
                    somethingWentWrong = data.status !== 100 && data.status !== 101;
                    isDeployedAndBuilding = data.status === 101;
                    isDeployedSuccessfully = data.status === 100;
                    if (somethingWentWrong) {
                        throw new Error(JSON.stringify(data, null, 2));
                    }
                    deleteFileFromDisk(filePath); // Uncomment this
                    // Save app to local storage
                    saveMachineToLocalStorage();
                    if (isDeployedAndBuilding) {
                        startFetchingBuildLogs();
                    }
                    if (isDeployedSuccessfully) {
                        printGreenMessage("Deployed successfully: " + DeployApi.appName + "\n", true);
                    }
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    printError(e_1.message, true);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function deleteFileFromDisk(filePath) {
    if (fs.pathExistsSync(filePath)) {
        fs.removeSync(filePath);
    }
}
module.exports = {
    gitArchiveFile: gitArchiveFile,
    getFileStream: getFileStream,
    uploadFile: uploadFile,
    startFetchingBuildLogs: startFetchingBuildLogs
};
