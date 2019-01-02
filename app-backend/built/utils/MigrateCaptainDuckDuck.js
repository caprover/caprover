"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs-extra");
const CaptainConstants = require("./CaptainConstants");
const path = require("path");
const Logger = require("./Logger");
const IRegistryInfo_1 = require("../models/IRegistryInfo");
const DockerApi_1 = require("../docker/DockerApi");
class MigrateCaptainDuckDuck {
    constructor(dataStore, authenticator) {
        this.dataStore = dataStore;
        this.authenticator = authenticator;
        this.oldFilePath = path.join(CaptainConstants.captainDataDirectory, 'config.conf');
    }
    migrateIfNeeded() {
        // TODO ensure this is all happening
        // Captain Boots-up
        // - Check if old conf file is available
        // - if so, then read json file and convert the old data into new data and save the data
        // - one all promises are done.
        // - Remove the old conf file and if it fails just hard crash.
        //
        // Migration limitations
        // Repos push webhook changes, need to be re-set in your git repo
        // Remote registries will need to be re-entered
        // Revert to version does not work for images built before the migration, e.g. failed deploys and images pushed to registry do not work
        const self = this;
        const oldFilePath = self.oldFilePath;
        if (!fs.pathExistsSync(oldFilePath)) {
            Logger.d('Migration not needed, skipping.');
            return Promise.resolve(false);
        }
        return this.performMigration().then(function () {
            return true;
        });
    }
    performMigration() {
        Logger.d('Migration starting now...');
        const self = this;
        const oldFilePath = self.oldFilePath;
        const dataStore = this.dataStore;
        return Promise.resolve()
            .then(function (data) {
            return fs.readJson(path.join(CaptainConstants.captainDataDirectory, 'config.conf'));
        })
            .then(function (dataRetrieved) {
            self.oldData = dataRetrieved;
        })
            .then(function () {
            Logger.d('Migrating basic configs...');
            const oldData = self.oldData;
            const promises = [];
            if (oldData.customDomain) {
                promises.push(dataStore.setCustomDomain(oldData.customDomain));
            }
            if (oldData.hashedPassword) {
                promises.push(dataStore.setHashedPassword(oldData.hashedPassword));
            }
            if (oldData.emailAddress) {
                promises.push(dataStore.setUserEmailAddress(oldData.emailAddress));
            }
            if (oldData.hasRootSsl) {
                promises.push(dataStore.setHasRootSsl(!!oldData.hasRootSsl));
            }
            if (oldData.forceRootSsl) {
                promises.push(dataStore.setForceSsl(!!oldData.forceRootSsl));
            }
            if (oldData.hasRegistrySsl) {
                promises.push(dataStore.setHasRegistrySsl(!!oldData.hasRegistrySsl));
            }
            if (oldData.NGINX_BASE_CONFIG || oldData.NGINX_CAPTAIN_CONFIG) {
                promises.push(dataStore.setNginxConfig(oldData.NGINX_BASE_CONFIG, oldData.NGINX_CAPTAIN_CONFIG));
            }
            if (oldData.netDataInfo && oldData.netDataInfo.isEnabled) {
                promises.push(dataStore.setNetDataInfo(oldData.netDataInfo));
            }
            return Promise.all(promises);
        })
            .then(function () {
            const oldData = self.oldData;
            if (!oldData.captainRegistryAuthSecretVer) {
                return Promise.resolve();
            }
            const authObj = JSON.parse(fs
                .readFileSync('/run/secrets/captain-reg-auth' +
                Number(oldData.captainRegistryAuthSecretVer))
                .toString());
            const registriesDataStore = dataStore.getRegistriesDataStore();
            if (authObj.serveraddress.endsWith((oldData.customDomain +
                ':' +
                CaptainConstants.configs
                    .registrySubDomainPort))) {
                // local
                return registriesDataStore
                    .addRegistryToDb(authObj.username, authObj.password, authObj.serveraddress, authObj.username, IRegistryInfo_1.IRegistryTypes.LOCAL_REG)
                    .then(function (idOfNewReg) {
                    return registriesDataStore.setDefaultPushRegistryId(idOfNewReg);
                });
            }
            else {
                // remote
                return registriesDataStore
                    .addRegistryToDb(authObj.username, authObj.password, authObj.serveraddress, authObj.username, IRegistryInfo_1.IRegistryTypes.REMOTE_REG)
                    .then(function (idOfNewReg) {
                    return registriesDataStore.setDefaultPushRegistryId(idOfNewReg);
                });
            }
        })
            .then(function () {
            return DockerApi_1.default.get().getAllServices();
        })
            .then(function (dockerServices) {
            const oldAppDefinitions = self.oldData.appDefinitions;
            if (!oldAppDefinitions)
                return Promise.resolve();
            function findCurrentlyInUseImageForApp(appNameToSearch) {
                for (let i = 0; i < dockerServices.length; i++) {
                    const element = dockerServices[i];
                    if (element.Spec.Name ===
                        'srv-captain--' + appNameToSearch) {
                        return element.Spec.TaskTemplate.ContainerSpec.Image;
                    }
                }
                return '';
            }
            const promises = [];
            Object.keys(oldAppDefinitions).forEach(appName => {
                const app = JSON.parse(JSON.stringify(oldAppDefinitions[appName]));
                const appStore = dataStore.getAppsDataStore();
                const p = Promise.resolve() //
                    .then(function () {
                    return appStore.registerAppDefinition(appName, !!app.hasPersistentData);
                })
                    .then(function () {
                    for (let index = 0; index < app.volumes.length; index++) {
                        const element = app.volumes[index];
                        element.type = undefined;
                    }
                    const repoInfo = {
                        user: '',
                        password: '',
                        branch: '',
                        repo: '',
                    };
                    if (app.appPushWebhook &&
                        app.appPushWebhook.repoInfo) {
                        const extracted = JSON.parse(Buffer.from(app.appPushWebhook.repoInfo.split('.')[1], 'base64').toString()).data;
                        repoInfo.user = extracted.user;
                        repoInfo.password = extracted.password;
                        repoInfo.branch = extracted.branch;
                        repoInfo.repo = extracted.repo;
                    }
                    return appStore
                        .updateAppDefinitionInDb(appName, Number(app.instanceCount), app.envVars || [], app.volumes || [], app.nodeId || '', !!app.notExposeAsWebApp, !!app.forceSsl, app.ports || [], repoInfo, self.authenticator, app.customNginxConfig, app.preDeployFunction)
                        .then(function () {
                        const oldVers = app.versions || [];
                        const newVers = [];
                        const newVersOnlyDeployVersion = [];
                        const deployedVersion = Number(app.deployedVersion);
                        oldVers.forEach(element => {
                            let thisVersion = Number(element.version);
                            let deployedImageName = `img-captain--${appName}:${thisVersion}`;
                            if (thisVersion === deployedVersion) {
                                deployedImageName = findCurrentlyInUseImageForApp(appName);
                                // Only add the currently deployed version. Revert won't work for other versions as
                                // it's impossible to guess their image name correct 100% due to the fact that
                                // we don't know if they were pushed to the registry or not
                                newVersOnlyDeployVersion.push({
                                    timeStamp: element.timeStamp || '',
                                    version: thisVersion,
                                    gitHash: element.gitHash,
                                    deployedImageName,
                                });
                            }
                            newVers.push({
                                timeStamp: element.timeStamp || '',
                                version: thisVersion,
                                gitHash: element.gitHash,
                                deployedImageName,
                            });
                        });
                        const deployedVersionFound = newVersOnlyDeployVersion.length === 1;
                        if (!deployedVersionFound) {
                            Logger.d('********* WARNING!! *********');
                            Logger.d(`** Not able to find the deployed image for ${appName}. This app might misbehave!! **`);
                        }
                        return appStore.setVersionsForMigration(appName, deployedVersionFound
                            ? newVersOnlyDeployVersion
                            : newVers, deployedVersion);
                    });
                });
                promises.push(p);
            });
            return Promise.all(promises).then(function () { });
        })
            .then(function () {
            Logger.d('Old data migrated to new format, deleting the old format...');
            fs.remove(oldFilePath);
        })
            .then(function () {
            Logger.d('Migration successfully done!');
            return Promise.resolve();
        });
    }
}
exports.default = MigrateCaptainDuckDuck;
//# sourceMappingURL=MigrateCaptainDuckDuck.js.map