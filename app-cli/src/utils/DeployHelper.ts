#!/usr/bin/env node

import * as inquirer from 'inquirer';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import StdOutUtil from '../utils/StdOutUtil';
const ProgressBar = require('progress');
const commandExistsSync = require('command-exists').sync;
import { validateIsGitRepository, validateDefinitionFile, ensureAuthentication } from '../utils/ValidationsHandler';
import { IMachine, IDeployedDirectory } from '../models/storage/StoredObjects';
import CliApiManager from '../api/CliApiManager';
import SpinnerHelper from '../utils/SpinnerHelper';
import IBuildLogs from '../models/IBuildLogs';

export default class DeployHelper {
	private lastLineNumberPrinted = -10000; // we want to show all lines to begin with!

	constructor(private machineToDeploy: IMachine, private appName: string, private branchToPush: string) {
		//
	}

	private gitArchiveFile(zipFileFullPath: string) {
		const self = this;
		return new Promise(function(resolve, reject) {
			exec(
				`git archive --format tar --output "${zipFileFullPath}" ${self.branchToPush}`,
				(err, stdout, stderr) => {
					if (err) {
						StdOutUtil.printError(`TAR file failed\n${err}\n`);

						fs.removeSync(zipFileFullPath);

						reject(new Error('TAR file failed'));
						return;
					}

					exec(`git rev-parse ${self.branchToPush}`, (err, stdout, stderr) => {
						const gitHash = (stdout || '').trim();

						if (err || !/^[a-f0-9]{40}$/.test(gitHash)) {
							StdOutUtil.printError(
								`Cannot find hash of last commit on this branch: ${self.branchToPush}\n${gitHash}\n${err}\n`
							);
							reject(new Error('rev-parse failed'));

							return;
						}

						StdOutUtil.printMessage(`Pushing last commit on ${self.branchToPush}: ${gitHash}`);
						resolve();
					});
				}
			);
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

			SpinnerHelper.start('Building your source code...');

			SpinnerHelper.setColor('yellow');
		});

		return fileStream;
	}

	async deployFromGitProject() {
		const appName = this.appName;
		const branchToPush = this.branchToPush;
		const machineToDeploy = this.machineToDeploy;

		if (!appName || !branchToPush || !machineToDeploy) {
			StdOutUtil.printError('Default deploy failed. Missing appName or branchToPush or machineToDeploy.', true);
			return;
		}

		if (!commandExistsSync('git')) {
			StdOutUtil.printError("'git' command not found...");

			StdOutUtil.printError("Captain needs 'git' to create tar file of your source files...", true);
			return;
		}

		StdOutUtil.printMessage(`Deploying ${appName} to ${machineToDeploy.name}`);

		await ensureAuthentication(machineToDeploy);

		const zipFileNameToDeploy = 'temporary-captain-to-deploy.tar';
		const zipFileFullPath = path.join(process.cwd(), zipFileNameToDeploy);

		StdOutUtil.printMessage(`Saving tar file to:\n${zipFileFullPath}\n`);

		// Removes the temporary file created
		if (fs.pathExistsSync(zipFileFullPath)) fs.removeSync(zipFileFullPath);

		await this.gitArchiveFile(zipFileFullPath);

		try {
			StdOutUtil.printMessage(`Uploading the file to ${machineToDeploy.baseUrl}`);

			await CliApiManager.get(machineToDeploy).uploadAppData(appName, this.getFileStream(zipFileFullPath));

			StdOutUtil.printMessage(`Upload done.`);

			fs.removeSync(zipFileFullPath);

			this.startFetchingBuildLogs(machineToDeploy, appName);
		} catch (e) {
			if (fs.pathExistsSync(zipFileFullPath)) fs.removeSync(zipFileFullPath);

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
				const appUrl = self.machineToDeploy.baseUrl
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
