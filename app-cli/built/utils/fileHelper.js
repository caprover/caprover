var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require("fs-extra");
const { printMessage, printError, printGreenMessage, printMagentaMessage } = require("./messageHandler");
const SpinnerHelper = require("../helpers/SpinnerHelper");
const { exec } = require("child_process");
const ProgressBar = require("progress");
const DeployApi = require("../api/DeployApi");
const { saveMachineToLocalStorage } = require("../utils/machineUtils");
let lastLineNumberPrinted = -10000; // we want to show all lines to begin with!
function gitArchiveFile(zipFileFullPath, branchToPush) {
    exec(`git archive --format tar --output "${zipFileFullPath}" ${branchToPush}`, (err, stdout, stderr) => {
        if (err) {
            printError(`TAR file failed\n${err}\n`);
            fs.removeSync(zipFileFullPath);
            return;
        }
        exec(`git rev-parse ${branchToPush}`, (err, stdout, stderr) => {
            const gitHash = (stdout || "").trim();
            if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
                printError(`Cannot find hash of last commit on this branch: ${branchToPush}\n${gitHash}\n${err}\n`);
                return;
            }
            printMessage(`Pushing last commit on ${branchToPush}: ${gitHash}`);
            uploadFile(zipFileFullPath, gitHash);
        });
    });
}
function onLogRetrieved(data) {
    if (data) {
        const lines = data.logs.lines;
        const firstLineNumberOfLogs = data.logs.firstLineNumber;
        let firstLinesToPrint = 0;
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
        for (let i = firstLinesToPrint; i < lines.length; i++) {
            printMessage((lines[i] || "").trim());
        }
    }
    const finishedBuilding = data && !data.isAppBuilding;
    if (finishedBuilding) {
        if (!data.isBuildFailed) {
            printGreenMessage(`Deployed successfully: ${DeployApi.appName}`);
            printMagentaMessage(`App is available at ${DeployApi.appUrl}\n`, true);
        }
        else {
            printError(`\nSomething bad happened. Cannot deploy "${DeployApi.appName}"\n`, true);
        }
    }
    setTimeout(() => {
        startFetchingBuildLogs();
    }, 2000);
}
function startFetchingBuildLogs() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const data = yield DeployApi.fetchBuildLogs();
            const response = JSON.parse(data);
            if (response.status !== 100) {
                throw new Error(JSON.stringify(response, null, 2));
            }
            onLogRetrieved(response.data);
        }
        catch (error) {
            printError(`\nSomething while retrieving app build logs.. ${error}\n`);
            // onLogRetrieved() // TODO - should this be here?
        }
    });
}
function getFileStream(zipFileFullPath) {
    const fileSize = fs.statSync(zipFileFullPath).size;
    const fileStream = fs.createReadStream(zipFileFullPath);
    const barOpts = {
        width: 20,
        total: fileSize,
        clear: true
    };
    const bar = new ProgressBar(" uploading [:bar] :percent  (ETA :etas)", barOpts);
    fileStream.on("data", chunk => {
        bar.tick(chunk.length);
    });
    fileStream.on("end", () => {
        printMessage("This might take several minutes. PLEASE BE PATIENT...");
        SpinnerHelper.start("Building your source code...");
        SpinnerHelper.setColor("yellow");
    });
    return fileStream;
}
function uploadFile(filePath, gitHash) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            printMessage(`Uploading file to ${DeployApi.machineToDeploy.baseUrl}`);
            const fileStream = getFileStream(filePath);
            const response = yield DeployApi.sendFile(fileStream, gitHash);
            const data = JSON.parse(response);
            const somethingWentWrong = data.status !== 100 && data.status !== 101;
            const isDeployedAndBuilding = data.status === 101;
            const isDeployedSuccessfully = data.status === 100;
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
                printGreenMessage(`Deployed successfully: ${DeployApi.appName}\n`, true);
            }
        }
        catch (e) {
            printError(e.message, true);
        }
    });
}
function deleteFileFromDisk(filePath) {
    if (fs.pathExistsSync(filePath)) {
        fs.removeSync(filePath);
    }
}
module.exports = {
    gitArchiveFile,
    getFileStream,
    uploadFile,
    startFetchingBuildLogs
};
//# sourceMappingURL=fileHelper.js.map