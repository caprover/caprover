#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const path = require("path");
const child_process_1 = require("child_process");
const StdOutUtil_1 = require("../utils/StdOutUtil");
const ProgressBar = require('progress');
const commandExistsSync = require('command-exists').sync;
const CliApiManager_1 = require("../api/CliApiManager");
const SpinnerHelper_1 = require("../utils/SpinnerHelper");
const StorageHelper_1 = require("./StorageHelper");
class DeployHelper {
    constructor(deployParams) {
        this.deployParams = deployParams;
        this.lastLineNumberPrinted = -10000; // we want to show all lines to begin with!
        //
    }
    gitArchiveFile(zipFileFullPath, branchToPush) {
        const self = this;
        return new Promise(function (resolve, reject) {
            // Removes the temporary file created
            if (fs.pathExistsSync(zipFileFullPath))
                fs.removeSync(zipFileFullPath);
            if (!commandExistsSync('git')) {
                StdOutUtil_1.default.printError("'git' command not found...\nCaptain needs 'git' to create tar file of your source files...", true);
                reject("Captain needs 'git' to create tar file of your source files...");
                return;
            }
            child_process_1.exec(`git archive --format tar --output "${zipFileFullPath}" ${branchToPush}`, (err, stdout, stderr) => {
                if (err) {
                    StdOutUtil_1.default.printError(`TAR file failed\n${err}\n`);
                    fs.removeSync(zipFileFullPath);
                    reject(new Error('TAR file failed'));
                    return;
                }
                child_process_1.exec(`git rev-parse ${branchToPush}`, (err, stdout, stderr) => {
                    const gitHash = (stdout || '').trim();
                    if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
                        StdOutUtil_1.default.printError(`Cannot find hash of last commit on this branch: ${branchToPush}\n${gitHash}\n${err}\n`);
                        reject(new Error('rev-parse failed'));
                        return;
                    }
                    StdOutUtil_1.default.printMessage(`Pushing last commit on ${branchToPush}: ${gitHash}`);
                    resolve(gitHash);
                });
            });
        });
    }
    getFileStream(zipFileFullPath) {
        const fileSize = fs.statSync(zipFileFullPath).size;
        const fileStream = fs.createReadStream(zipFileFullPath);
        const barOpts = {
            width: 20,
            total: fileSize,
            clear: false
        };
        const bar = new ProgressBar(' uploading [:bar] :percent  (ETA :etas)', barOpts);
        fileStream.on('data', (chunk) => {
            bar.tick(chunk.length);
        });
        fileStream.on('end', () => {
            StdOutUtil_1.default.printMessage('This might take several minutes. PLEASE BE PATIENT...');
            SpinnerHelper_1.default.start('Building your source code...\n');
            SpinnerHelper_1.default.setColor('yellow');
        });
        return fileStream;
    }
    startDeploy() {
        return __awaiter(this, void 0, void 0, function* () {
            const appName = this.deployParams.appName;
            const branchToPush = this.deployParams.deploySource.branchToPush;
            const tarFilePath = this.deployParams.deploySource.tarFilePath;
            const machineToDeploy = this.deployParams.captainMachine;
            const deploySource = this.deployParams.deploySource;
            if (!appName || (!branchToPush && !tarFilePath) || !machineToDeploy) {
                StdOutUtil_1.default.printError('Default deploy failed. Missing appName or branchToPush/tarFilePath or machineToDeploy.', true);
                return;
            }
            if (branchToPush && tarFilePath) {
                StdOutUtil_1.default.printError('Default deploy failed. branchToPush/tarFilePath cannot both be present.', true);
                return;
            }
            let tarFileCreatedByCli = false;
            const tarFileNameToDeploy = tarFilePath ? tarFilePath : 'temporary-captain-to-deploy.tar';
            const tarFileFullPath = tarFileNameToDeploy.startsWith('/')
                ? tarFileNameToDeploy // absolute path
                : path.join(process.cwd(), tarFileNameToDeploy); // relative path
            let gitHash = '';
            if (branchToPush) {
                tarFileCreatedByCli = true;
                StdOutUtil_1.default.printMessage(`Saving tar file to:\n${tarFileFullPath}\n`);
                gitHash = yield this.gitArchiveFile(tarFileFullPath, branchToPush);
            }
            StdOutUtil_1.default.printMessage(`Deploying ${appName} to ${machineToDeploy.name}`);
            try {
                StdOutUtil_1.default.printMessage(`Uploading the file to ${machineToDeploy.baseUrl}`);
                yield CliApiManager_1.default.get(machineToDeploy).uploadAppData(appName, this.getFileStream(tarFileFullPath));
                StdOutUtil_1.default.printMessage(`Upload done.`);
                StorageHelper_1.default.get().saveDeployedDirectory({
                    appName: appName,
                    cwd: process.cwd(),
                    deploySource: deploySource,
                    machineNameToDeploy: machineToDeploy.name
                });
                if (tarFileCreatedByCli && fs.pathExistsSync(tarFileFullPath))
                    fs.removeSync(tarFileFullPath);
                this.startFetchingBuildLogs(machineToDeploy, appName);
            }
            catch (e) {
                if (tarFileCreatedByCli && fs.pathExistsSync(tarFileFullPath))
                    fs.removeSync(tarFileFullPath);
                throw e;
            }
        });
    }
    onLogRetrieved(data, machineToDeploy, appName) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            if (data) {
                const lines = data.logs.lines;
                const firstLineNumberOfLogs = data.logs.firstLineNumber;
                let firstLinesToPrint = 0;
                if (firstLineNumberOfLogs > this.lastLineNumberPrinted) {
                    if (firstLineNumberOfLogs < 0) {
                        // This is the very first fetch, probably firstLineNumberOfLogs is around -50
                        firstLinesToPrint = -firstLineNumberOfLogs;
                    }
                    else {
                        StdOutUtil_1.default.printMessage('[[ TRUNCATED ]]');
                    }
                }
                else {
                    firstLinesToPrint = this.lastLineNumberPrinted - firstLineNumberOfLogs;
                }
                this.lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;
                for (let i = firstLinesToPrint; i < lines.length; i++) {
                    StdOutUtil_1.default.printMessage((lines[i] || '').trim());
                }
            }
            if (data && !data.isAppBuilding) {
                if (!data.isBuildFailed) {
                    const appUrl = self.deployParams.captainMachine.baseUrl
                        .replace('https://', 'http://')
                        .replace('//captain.', '//' + appName + '.');
                    StdOutUtil_1.default.printGreenMessage(`\n\n\nDeployed successfully: ${appName}`);
                    StdOutUtil_1.default.printMagentaMessage(`App is available at ${appUrl}`, true);
                }
                else {
                    StdOutUtil_1.default.printError(`\n\nSomething bad happened. Cannot deploy "${appName}"\n`, true);
                }
            }
            else {
                setTimeout(() => {
                    this.startFetchingBuildLogs(machineToDeploy, appName);
                }, 2000);
            }
        });
    }
    startFetchingBuildLogs(machineToDeploy, appName) {
        return __awaiter(this, void 0, void 0, function* () {
            const self = this;
            try {
                const data = yield CliApiManager_1.default.get(machineToDeploy).fetchBuildLogs(appName);
                this.onLogRetrieved(data, machineToDeploy, appName);
            }
            catch (error) {
                StdOutUtil_1.default.printError(`\nSomething while retrieving app build logs.. ${error}\n`);
                this.onLogRetrieved(undefined, machineToDeploy, appName);
            }
        });
    }
}
exports.default = DeployHelper;
//# sourceMappingURL=DeployHelper.js.map