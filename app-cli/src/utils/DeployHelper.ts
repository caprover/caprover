#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import StdOutUtil from '../utils/StdOutUtil';
const ProgressBar = require('progress');
const commandExistsSync = require('command-exists').sync;
import { IMachine, IDeployParams } from '../models/storage/StoredObjects';
import CliApiManager from '../api/CliApiManager';
import SpinnerHelper from '../utils/SpinnerHelper';
import IBuildLogs from '../models/IBuildLogs';

export default class DeployHelper {
	private lastLineNumberPrinted = -10000; // we want to show all lines to begin with!

	constructor(private deployParams: IDeployParams) {
		//
	}

	private gitArchiveFile(zipFileFullPath: string, branchToPush: string) {
		const self = this;
		return new Promise<string>(function(resolve, reject) {
			// Removes the temporary file created
			if (fs.pathExistsSync(zipFileFullPath)) fs.removeSync(zipFileFullPath);

			if (!commandExistsSync('git')) {
				StdOutUtil.printError(
					"'git' command not found...\nCaptain needs 'git' to create tar file of your source files...",
					true
				);
				reject("Captain needs 'git' to create tar file of your source files...");
				return;
			}

			exec(`git archive --format tar --output "${zipFileFullPath}" ${branchToPush}`, (err, stdout, stderr) => {
				if (err) {
					StdOutUtil.printError(`TAR file failed\n${err}\n`);

					fs.removeSync(zipFileFullPath);

					reject(new Error('TAR file failed'));
					return;
				}

				exec(`git rev-parse ${branchToPush}`, (err, stdout, stderr) => {
					const gitHash = (stdout || '').trim();

					if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
						StdOutUtil.printError(
							`Cannot find hash of last commit on this branch: ${branchToPush}\n${gitHash}\n${err}\n`
						);
						reject(new Error('rev-parse failed'));

						return;
					}

					StdOutUtil.printMessage(`Pushing last commit on ${branchToPush}: ${gitHash}`);
					resolve(gitHash);
				});
			});
		});
	}

	private getFileStream(zipFileFullPath: string) {
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
			StdOutUtil.printMessage('This might take several minutes. PLEASE BE PATIENT...');

			SpinnerHelper.start('Building your source code...\n');

			SpinnerHelper.setColor('yellow');
		});

		return fileStream;
	}

	async startDeploy() {
		const appName = this.deployParams.appName;
		const branchToPush = this.deployParams.deploySource.branchToPush;
		const tarFilePath = this.deployParams.deploySource.tarFilePath;
		const machineToDeploy = this.deployParams.captainMachine;

		if (!appName || (!branchToPush && !tarFilePath) || !machineToDeploy) {
			StdOutUtil.printError(
				'Default deploy failed. Missing appName or branchToPush/tarFilePath or machineToDeploy.',
				true
			);
			return;
		}

		if (branchToPush && tarFilePath) {
			StdOutUtil.printError('Default deploy failed. branchToPush/tarFilePath cannot both be present.', true);
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

			StdOutUtil.printMessage(`Saving tar file to:\n${tarFileFullPath}\n`);

			gitHash = await this.gitArchiveFile(tarFileFullPath, branchToPush);
		}

		StdOutUtil.printMessage(`Deploying ${appName} to ${machineToDeploy.name}`);

		try {
			StdOutUtil.printMessage(`Uploading the file to ${machineToDeploy.baseUrl}`);

			await CliApiManager.get(machineToDeploy).uploadAppData(appName, this.getFileStream(tarFileFullPath));

			StdOutUtil.printMessage(`Upload done.`);

			if (tarFileCreatedByCli && fs.pathExistsSync(tarFileFullPath)) fs.removeSync(tarFileFullPath);

			this.startFetchingBuildLogs(machineToDeploy, appName);
		} catch (e) {
			if (tarFileCreatedByCli && fs.pathExistsSync(tarFileFullPath)) fs.removeSync(tarFileFullPath);

			throw e;
		}
	}

	private async onLogRetrieved(data: IBuildLogs | undefined, machineToDeploy: IMachine, appName: string) {
		const self = this;
		if (data) {
			const lines = data.logs.lines;
			const firstLineNumberOfLogs = data.logs.firstLineNumber;
			let firstLinesToPrint = 0;

			if (firstLineNumberOfLogs > this.lastLineNumberPrinted) {
				if (firstLineNumberOfLogs < 0) {
					// This is the very first fetch, probably firstLineNumberOfLogs is around -50
					firstLinesToPrint = -firstLineNumberOfLogs;
				} else {
					StdOutUtil.printMessage('[[ TRUNCATED ]]');
				}
			} else {
				firstLinesToPrint = this.lastLineNumberPrinted - firstLineNumberOfLogs;
			}

			this.lastLineNumberPrinted = firstLineNumberOfLogs + lines.length;

			for (let i = firstLinesToPrint; i < lines.length; i++) {
				StdOutUtil.printMessage((lines[i] || '').trim());
			}
		}

		if (data && !data.isAppBuilding) {
			if (!data.isBuildFailed) {
				const appUrl = self.deployParams.captainMachine!.baseUrl
					.replace('https://', 'http://')
					.replace('//captain.', '//' + appName + '.');
				StdOutUtil.printGreenMessage(`Deployed successfully: ${appName}`);

				StdOutUtil.printMagentaMessage(`App is available at ${appUrl}`, true);
			} else {
				StdOutUtil.printError(`\nSomething bad happened. Cannot deploy "${appName}"\n`, true);
			}
		} else {
			setTimeout(() => {
				this.startFetchingBuildLogs(machineToDeploy, appName);
			}, 2000);
		}
	}

	private async startFetchingBuildLogs(machineToDeploy: IMachine, appName: string) {
		const self = this;
		try {
			const data = await CliApiManager.get(machineToDeploy).fetchBuildLogs(appName);
			this.onLogRetrieved(data, machineToDeploy, appName);
		} catch (error) {
			StdOutUtil.printError(`\nSomething while retrieving app build logs.. ${error}\n`);
			this.onLogRetrieved(undefined, machineToDeploy, appName);
		}
	}
}
