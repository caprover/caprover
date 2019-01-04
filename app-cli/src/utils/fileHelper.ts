const { printMessage, printError, printGreenMessage, printMagentaMessage } = require('./messageHandler');
const SpinnerHelper = require('../helpers/SpinnerHelper');
import { exec } from 'child_process';
import * as fs from 'fs-extra';
const ProgressBar = require('progress');
const DeployApi = require('../api/DeployApi');
const { saveMachineToLocalStorage } = require('../utils/machineUtils');
let lastLineNumberPrinted = -10000; // we want to show all lines to begin with!

interface ILogInfo {
	isAppBuilding: boolean;
	isBuildFailed: boolean;
	logs: {
		firstLineNumber: number;
		lines: string[];
	};
}

function gitArchiveFile(zipFileFullPath: string, branchToPush: string) {
	exec(`git archive --format tar --output "${zipFileFullPath}" ${branchToPush}`, (err, stdout, stderr) => {
		if (err) {
			printError(`TAR file failed\n${err}\n`);

			fs.removeSync(zipFileFullPath);

			return;
		}

		exec(`git rev-parse ${branchToPush}`, (err, stdout, stderr) => {
			const gitHash = (stdout || '').trim();

			if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
				printError(`Cannot find hash of last commit on this branch: ${branchToPush}\n${gitHash}\n${err}\n`);

				return;
			}

			printMessage(`Pushing last commit on ${branchToPush}: ${gitHash}`);

			uploadFile(zipFileFullPath, gitHash);
		});
	});
}

function onLogRetrieved(data: ILogInfo) {
	if (data) {
		const lines = data.logs.lines;
		const firstLineNumberOfLogs = data.logs.firstLineNumber;
		let firstLinesToPrint = 0;

		if (firstLineNumberOfLogs > lastLineNumberPrinted) {
			if (firstLineNumberOfLogs < 0) {
				// This is the very first fetch, probably firstLineNumberOfLogs is around -50
				firstLinesToPrint = -firstLineNumberOfLogs;
			} else {
				printMessage('[[ TRUNCATED ]]');
			}
		} else {
			firstLinesToPrint = lastLineNumberPrinted - firstLineNumberOfLogs;
		}

		lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;

		for (let i = firstLinesToPrint; i < lines.length; i++) {
			printMessage((lines[i] || '').trim());
		}
	}

	const finishedBuilding = data && !data.isAppBuilding;

	if (finishedBuilding) {
		if (!data.isBuildFailed) {
			printGreenMessage(`Deployed successfully: ${DeployApi.appName}`);

			printMagentaMessage(`App is available at ${DeployApi.appUrl}\n`, true);
		} else {
			printError(`\nSomething bad happened. Cannot deploy "${DeployApi.appName}"\n`, true);
		}
	}

	setTimeout(() => {
		startFetchingBuildLogs();
	}, 2000);
}

async function startFetchingBuildLogs() {
	try {
		const data = await DeployApi.fetchBuildLogs();
		const response = JSON.parse(data);

		if (response.status !== 100) {
			throw new Error(JSON.stringify(response, null, 2));
		}
		onLogRetrieved(response.data);
	} catch (error) {
		printError(`\nSomething while retrieving app build logs.. ${error}\n`);

		// onLogRetrieved() // TODO - should this be here?
	}
}

function getFileStream(zipFileFullPath: string) {
	const fileSize = fs.statSync(zipFileFullPath).size;
	const fileStream = fs.createReadStream(zipFileFullPath);
	const barOpts = {
		width: 20,
		total: fileSize,
		clear: true
	};
	const bar = new ProgressBar(' uploading [:bar] :percent  (ETA :etas)', barOpts);

	fileStream.on('data', (chunk) => {
		bar.tick(chunk.length);
	});

	fileStream.on('end', () => {
		printMessage('This might take several minutes. PLEASE BE PATIENT...');

		SpinnerHelper.start('Building your source code...');

		SpinnerHelper.setColor('yellow');
	});

	return fileStream;
}

async function uploadFile(filePath: string, gitHash: string) {
	try {
		printMessage(`Uploading file to ${DeployApi.machineToDeploy.baseUrl}`);

		const fileStream = getFileStream(filePath);
		const response = await DeployApi.sendFile(fileStream, gitHash);
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
	} catch (e) {
		printError(e.message, true);
	}
}

function deleteFileFromDisk(filePath: string) {
	if (fs.pathExistsSync(filePath)) {
		fs.removeSync(filePath);
	}
}
export = {
	gitArchiveFile,
	getFileStream,
	uploadFile,
	startFetchingBuildLogs
};
