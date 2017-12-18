const CaptainConstants = require('../utils/CaptainConstants');
const Logger = require('../utils/Logger');
const fs = require('fs-extra');
const tar = require('tar');
const path = require('path');
const CaptainManager = require('./CaptainManager');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const TemplateHelper = require('./TemplateHelper');
const Authenticator = require('./Authenticator');
const GitHelper = require('../utils/GitHelper');
const uuid = require('uuid/v4');

const SOURCE_FOLDER_NAME = 'src';
const DOCKER_FILE = 'Dockerfile';
const CAPTAIN_DEFINITION_FILE = 'captain-definition';
const PLACEHOLDER_DOCKER_FILE_CONTENT = 'FROM ' + CaptainConstants.appPlaceholderImageName
    + '\nCMD [ "npm", "start" ]';

function getRawImageSourceFolder(imageName, newVersionPulled) {
    return CaptainConstants.captainRawImagesDir + '/' + imageName + '/' + newVersionPulled + '/' + SOURCE_FOLDER_NAME;
}

function getRawImageBaseFolder(imageName, newVersionPulled) {
    return CaptainConstants.captainRawImagesDir + '/' + imageName + '/' + newVersionPulled;
}

function getTarImageBaseFolder(imageName, newVersionPulled) {
    return CaptainConstants.captainTarImagesDir + '/' + imageName + '/' + newVersionPulled;
}

function getCaptainDefinitionTempFolder(serviceName, randomSuffix) {
    return CaptainConstants.captainDefinitionTempDir + '/' + serviceName + '/' + randomSuffix;
}

class ServiceManager {

    constructor(user, dockerApi, loadBalancerManager) {
        this.user = user;
        this.dataStore = user.dataStore;
        this.dockerApi = dockerApi;
        this.loadBalancerManager = loadBalancerManager;
        this.activeBuilds = {};

        this.isReady = true;

    }

    isInited() {
        return this.isReady;
    }

    createTarFarFromCaptainContent(captainDefinitionContent, appName, tarDestination) {

        let serviceName = this.dataStore.getServiceName(appName);

        let captainDefinitionDirPath;

        return Promise.resolve()
            .then(function () {

                for (let i = 0; i < 100; i++) {
                    let temp = getCaptainDefinitionTempFolder(serviceName, uuid());
                    if (!fs.pathExistsSync(temp)) {
                        captainDefinitionDirPath = temp;
                        break;
                    }
                }

                if (!captainDefinitionDirPath) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Cannot create a temp file! Something is seriously wrong with the temp folder");
                }

                return fs.outputFile(captainDefinitionDirPath + '/' + CAPTAIN_DEFINITION_FILE, captainDefinitionContent);

            })
            .then(function () {

                return tar.c({
                    file: tarDestination,
                    cwd: captainDefinitionDirPath
                }, [CAPTAIN_DEFINITION_FILE]);

            })
            .then(function () {

                return fs.remove(captainDefinitionDirPath);

            });
    }

    /**
     *
     * @param appName
     * @param source
     *                 pathToSrcTarballFile
     *                   OR
     *                 repoInfo : {repo, user, password, branch}
     * @param gitHash
     * @returns {Promise<void>}
     */
    createImage(appName, source, gitHash) {

        Logger.d('Creating image for: ' + appName);

        const self = this;

        let imageName = this.dataStore.getImageName(CaptainManager.get().getDockerAuthObject(), appName);
        let dockerApi = this.dockerApi;
        let dataStore = this.dataStore;
        let newVersion = null;
        let rawImageSourceFolder = null;
        let rawImageBaseFolder = null;
        let tarImageBaseFolder = null;
        let tarballFilePath = null;
        let dockerFilePath = null;

        this.activeBuilds[appName] = true;

        return Promise.resolve()
            .then(function () {

                return dataStore.getNewVersion(appName);

            })
            .then(function (newVersionPulled) {

                newVersion = newVersionPulled;

                rawImageSourceFolder = getRawImageSourceFolder(imageName, newVersionPulled);
                rawImageBaseFolder = getRawImageBaseFolder(imageName, newVersionPulled);
                dockerFilePath = rawImageBaseFolder + '/' + DOCKER_FILE;

                tarImageBaseFolder = getTarImageBaseFolder(imageName, newVersionPulled);
                tarballFilePath = tarImageBaseFolder + '/image.tar';


                return fs.ensureDir(rawImageSourceFolder)
                    .then(function () {
                        return rawImageSourceFolder
                    });
            })
            .then(function (rawImageSourceFolder) {

                let promiseToFetchDirectory = null;

                if (source.pathToSrcTarballFile) {
                    promiseToFetchDirectory = tar
                        .x({
                            file: source.pathToSrcTarballFile,
                            cwd: rawImageSourceFolder
                        })
                        .then(function () {
                            return gitHash;
                        });
                }
                else if (source.repoInfo) {
                    let repoInfo = source.repoInfo;
                    promiseToFetchDirectory = GitHelper
                        .clone(repoInfo.user, repoInfo.password, repoInfo.repo, repoInfo.branch, rawImageSourceFolder)
                        .then(function () {
                            return GitHelper.getLastHash(rawImageSourceFolder);
                        });
                }
                else {
                    return PLACEHOLDER_DOCKER_FILE_CONTENT;
                }

                return promiseToFetchDirectory
                    .then(function (gitHashToSave) {

                        return dataStore.setGitHash(appName, newVersion, gitHashToSave);

                    })
                    .then(function () {

                        return fs.pathExists(rawImageSourceFolder + '/' + CAPTAIN_DEFINITION_FILE)

                    })
                    .then(function (exists) {

                        if (!exists) {

                            Logger.d('Captain Definition does not exist in the base tar. Looking inside...');

                            // check if there is only one child
                            // check if it's a directory
                            // check if captain definition exists in it
                            // rename rawImageSourceFolder to rawImageSourceFolder+'.bak'
                            // move the child directory out to base and rename it to rawImageSourceFolder
                            // read captain definition from the folder and return it.

                            let directoryInside = null;

                            return new Promise(
                                function (resolve, reject) {

                                    fs.readdir(rawImageSourceFolder, function (err, files) {

                                        if (err) {
                                            reject(err);
                                            return;
                                        }

                                        if (files.length !== 1 || !fs.statSync(path.join(rawImageSourceFolder, files[0])).isDirectory()) {
                                            reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition file does not exist!"));
                                            return;
                                        }

                                        resolve(files[0]);

                                    });
                                })
                                .then(function (directory) {

                                    directoryInside = directory;

                                    return fs.pathExists(path.join(path.join(rawImageSourceFolder, directoryInside), CAPTAIN_DEFINITION_FILE));

                                })
                                .then(function (captainDefinitionExists) {

                                    if (!captainDefinitionExists) {
                                        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition file does not exist!");
                                    }

                                    const BAK = '.bak';

                                    fs.renameSync(rawImageSourceFolder, rawImageSourceFolder + BAK);
                                    fs.renameSync(path.join(rawImageSourceFolder + BAK, directoryInside), rawImageSourceFolder);

                                });
                        }
                    })
                    .then(function () {

                        return fs.readJson(rawImageSourceFolder + '/' + CAPTAIN_DEFINITION_FILE);

                    })
                    .then(function (data) {

                        if (!data) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition File is empty!");
                        }

                        if (!data.schemaVersion) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition version is empty!");
                        }

                        if (data.schemaVersion === 1) {

                            let templateIdTag = data.templateId;
                            let dockerfileLines = data.dockerfileLines;
                            let hasDockerfileLines = dockerfileLines && dockerfileLines.length > 0;

                            if (hasDockerfileLines && !templateIdTag) {

                                return dockerfileLines.join('\n');

                            }
                            else if (!hasDockerfileLines && templateIdTag) {

                                return TemplateHelper.get().getDockerfileContentFromTemplateTag(templateIdTag);

                            }
                            else {

                                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Dockerfile or TemplateId must be present. Both should not be present at the same time");

                            }

                        }
                        else {

                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition version is not supported!");

                        }
                    });

            })
            .then(function (dockerfileContent) {

                return fs.outputFile(dockerFilePath, dockerfileContent);

            })
            .then(function () {

                return fs.ensureDir(tarImageBaseFolder);

            })
            .then(function () {

                return tar.c({
                    file: tarballFilePath,
                    cwd: rawImageBaseFolder
                }, [SOURCE_FOLDER_NAME, DOCKER_FILE]);

            })
            .then(function () {

                return dockerApi
                    .buildImageFromDockerFile(imageName, newVersion, tarballFilePath)
                    .catch(function (error) {
                        throw ApiStatusCodes.createError(ApiStatusCodes.BUILD_ERROR, ('' + error).trim());
                    })

            })
            .then(function () {

                Logger.d('Cleaning up up the files... ' + tarImageBaseFolder + '  and  ' + rawImageBaseFolder);

                return fs.remove(tarImageBaseFolder);

            })
            .then(function () {

                return fs.remove(rawImageBaseFolder);

            })
            .then(function () {

                let authObj = CaptainManager.get().getDockerAuthObject();

                if (!authObj) {
                    Logger.d('No Docker Auth is found. Skipping pushing the image.');
                    return true;
                }

                Logger.d('Docker Auth is found. Pushing the image...');

                return dockerApi
                    .pushImage(imageName, newVersion, authObj);

            })
            .then(function () {
                self.activeBuilds[appName] = false;
                return newVersion;
            })
            .catch(function (error) {
                self.activeBuilds[appName] = false;
                return new Promise(function (resolve, reject) {
                    reject(error);
                })
            });
    }

    enableCustomDomainSsl(appName, customDomain) {

        const self = this;

        return Promise.resolve()
            .then(function () {

                Logger.d('Verifying Captain owns domain: ' + customDomain);

                return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(customDomain);

            })
            .then(function () {

                if (!appName) {
                    throw new Error('No App Name! Cannot verify domain');
                }

                Logger.d('Enabling SSL for: ' + appName + ' on ' + customDomain);

                return self.dataStore.verifyCustomDomainBelongsToApp(appName, customDomain);

            })
            .then(function () {

                return CaptainManager.get().requestCertificateForDomain(customDomain);

            })
            .then(function () {

                return self.dataStore.enableCustomDomainSsl(appName, customDomain);

            })
            .then(function () {

                return self.reloadLoadBalancer();

            });
    }

    addCustomDomain(appName, customDomain) {

        const self = this;

        return Promise.resolve()
            .then(function () {

                let rootDomain = self.dataStore.getRootDomain();
                let isAllowed = (!!customDomain)
                    && (customDomain.length < 80)
                    && /^[a-z0-9\-\.]+$/.test(customDomain)
                    && (customDomain.indexOf('..') < 0)
                    && (customDomain.indexOf(rootDomain) < 0 || (customDomain === rootDomain) || ((customDomain.indexOf(rootDomain) + rootDomain.length) !== customDomain.length));

                if (!isAllowed) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca');
                }

            })
            .then(function () {

                return CaptainManager.get().verifyDomainResolvesToDefaultServerOnHost(customDomain);

            })
            .then(function () {

                if (!appName) {
                    throw new Error('No App Name! Cannot verify domain');
                }

                Logger.d('Enabling custom domain for: ' + appName);

                return self.dataStore.addCustomDomainForApp(appName, customDomain);

            })
            .then(function () {

                return self.reloadLoadBalancer();

            });
    }

    removeCustomDomain(appName, customDomain) {
        const self = this;

        return Promise.resolve()
            .then(function () {

                if (!appName) {
                    throw new Error('No App Name! Cannot verify domain');
                }

                Logger.d('Removing custom domain for: ' + appName);

                return self.dataStore.removeCustomDomainForApp(appName, customDomain);

            })
            .then(function () {

                return self.reloadLoadBalancer();

            });
    }

    enableSslForApp(appName) {

        const self = this;

        let rootDomain = null;
        let app = null;

        return Promise.resolve()
            .then(function () {

                return self.verifyCaptainOwnsGenericSubDomain(appName);

            })
            .then(function () {

                Logger.d('Enabling SSL for: ' + appName);

                if (!appName) {
                    throw new Error('No App Name! Cannot verify domain');
                }

                return self.dataStore.getRootDomain();

            })
            .then(function (val) {

                rootDomain = val;

                if (!rootDomain) {
                    throw new Error('No rootDomain! Cannot verify domain');
                }

            })
            .then(function () {

                return self.dataStore.getAppDefinitions();

            })
            .then(function (apps) {

                app = apps[appName];

                if (!app) {
                    throw new Error('Unknown app');
                }

                return appName + '.' + rootDomain;

            })
            .then(function (domainName) {

                return CaptainManager.get().requestCertificateForDomain(domainName);

            })
            .then(function () {

                return self.dataStore.enableSslForDefaultSubDomain(appName);

            })
            .then(function () {

                return self.reloadLoadBalancer();

            });
    }

    verifyCaptainOwnsGenericSubDomain(appName) {

        const self = this;

        let rootDomain = null;

        return Promise.resolve()
            .then(function () {

                if (!appName) {
                    throw new Error('No App Name! Cannot verify domain');
                }

                return self.dataStore.getRootDomain();

            })
            .then(function (val) {

                rootDomain = val;

            })
            .then(function () {

                return self.dataStore.getAppDefinitions();

            })
            .then(function (apps) {

                const app = apps[appName];

                if (!app) {
                    throw new Error('Unknown app');
                }

                return appName + '.' + rootDomain;

            })
            .then(function (domainName) {

                Logger.d('Verifying Captain owns domain: ' + domainName);

                return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(domainName);

            });
    }

    removeApp(appName) {
        Logger.d('Removing service for: ' + appName);
        const self = this;

        let serviceName = this.dataStore.getServiceName(appName);
        let dockerApi = this.dockerApi;
        let dataStore = this.dataStore;

        return Promise.resolve()
            .then(function () {

                Logger.d('Check if service is running: ' + serviceName);
                return dockerApi
                    .isServiceRunningByName(serviceName);

            })
            .then(function (isRunning) {
                if (isRunning) {
                    return dockerApi
                        .removeService(serviceName);
                }
                else {
                    Logger.w('Cannot delete service... It is not running: ' + serviceName);
                    return true;
                }

            })
            .then(function () {

                return dataStore.deleteAppDefinition(appName);

            })
            .then(function () {

                return self.reloadLoadBalancer();

            });
    }

    ensureServiceInitedAndUpdated(appName, version) {

        Logger.d('Ensure service inited and Updated for: ' + appName);
        const self = this;

        let serviceName = this.dataStore.getServiceName(appName);
        const dockerAuthObject = CaptainManager.get().getDockerAuthObject();
        let imageName = this.dataStore.getImageName(dockerAuthObject, appName, version);
        let dockerApi = this.dockerApi;
        let dataStore = this.dataStore;
        let app = null;

        return dataStore.setDeployedVersion(appName, version)
            .then(function () {
                return dataStore.getAppDefinitions()
                    .then(function (apps) {
                        Logger.d('App definitions retrieved');
                        return apps[appName];
                    });
            })
            .then(function (appFound) {
                app = appFound;

                if (!appFound) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name not found!');
                }

                Logger.d('Check if service is running: ' + serviceName);
                return dockerApi
                    .isServiceRunningByName(serviceName);
            })
            .then(function (isRunning) {
                if (isRunning) {
                    Logger.d('Service is already running: ' + serviceName);
                    return true;
                }
                else {
                    Logger.d('Creating service: ' + serviceName + ' with image: ' + imageName);
                    // if we pass in networks here. Almost always it results in a delayed update which causes
                    // update errors if they happen right away!
                    return dockerApi
                        .createServiceOnNodeId(imageName, serviceName);
                }
            })
            .then(function () {

                Logger.d('Updating service: ' + serviceName + ' with image: ' + imageName);

                return dockerApi
                    .updateService(serviceName, imageName, app.volumes, app.networks, app.envVars, null, dockerAuthObject, Number(app.instanceCount), app.nodeId, dataStore.getNameSpace());

            })
            .then(function () {
                return new Promise(function (resolve) {
                    // Waiting 2 extra seconds for docker DNS to pickup the service name
                    setTimeout(resolve, 2000);
                });
            })
            .then(function () {

                return self.reloadLoadBalancer();
            });
    }

    updateAppDefinition(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, ports, appPushWebhook) {

        const self = this;
        const dataStore = this.dataStore;
        const dockerApi = this.dockerApi;

        let serviceName = null;

        let checkIfNodeIdExists = function (nodeIdToCheck) {
            return dockerApi
                .getNodesInfo()
                .then(function (nodeInfo) {

                    for (let i = 0; i < nodeInfo.length; i++) {
                        if (nodeIdToCheck === nodeInfo[i].nodeId) {
                            return;
                        }
                    }

                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Node ID you requested in not part of the swarm " + nodeIdToCheck);

                });
        };

        return Promise.resolve()
            .then(function () {

                return dataStore.getAppDefinition(appName);

            })
            .then(function (app) {

                serviceName = dataStore.getServiceName(appName);

                // After leaving this block, nodeId will be guaranteed to be NonNull
                if (app.hasPersistentData) {

                    if (instanceCount !== 1) {
                        throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, ('App with persistent data can only have 1 instance: ' + appName));
                    }

                    if (nodeId) {

                        return checkIfNodeIdExists(nodeId);

                    }
                    else {

                        if (app.nodeId) {

                            nodeId = app.nodeId;

                        }
                        else {

                            return dockerApi
                                .isServiceRunningByName(serviceName)
                                .then(function (isRunning) {
                                    if (!isRunning) {
                                        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Cannot find the service. Try again in a minute...");
                                    }
                                    return dockerApi
                                        .getNodeIdByServiceName(serviceName);
                                })
                                .then(function (nodeIdRunningService) {
                                    if (!nodeIdRunningService) {
                                        throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "No NodeId was found. Try again in a minute...");
                                    }

                                    nodeId = nodeIdRunningService;

                                });
                        }

                    }

                }
                else {
                    if (volumes && volumes.length) {
                        throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, "Cannot set volumes for a non-persistent container!");
                    }

                    if (nodeId) {

                        return checkIfNodeIdExists(nodeId);
                    }
                }

            })
            .then(function () {

                return dataStore.updateAppDefinitionInDb(appName, instanceCount, envVars, volumes, nodeId,
                    notExposeAsWebApp, ports, appPushWebhook, Authenticator.get(dataStore.getNameSpace()));

            })
            .then(function () {
                return self.updateServiceOnDefinitionUpdate(appName);
            })
            .then(function () {
                return self.reloadLoadBalancer();
            });
    }

    isAppBuilding(appName) {
        return !!this.activeBuilds[appName];
    }

    updateServiceOnDefinitionUpdate(appName) {

        let serviceName = this.dataStore.getServiceName(appName);
        const dockerAuthObject = CaptainManager.get().getDockerAuthObject();

        const dataStore = this.dataStore;
        const dockerApi = this.dockerApi;

        return Promise.resolve()
            .then(function () {
                return dataStore.getAppDefinition(appName);
            })
            .then(function (appFound) {

                if (!appFound) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name not found!');
                }

                return dockerApi
                    .updateService(serviceName, null, appFound.volumes, appFound.networks, appFound.envVars, null,
                        dockerAuthObject, Number(appFound.instanceCount), appFound.nodeId, dataStore.getNameSpace(),
                        appFound.ports);
            });

    }

    reloadLoadBalancer() {

        Logger.d('Updating Load Balancer');
        const self = this;
        return self.loadBalancerManager.rePopulateNginxConfigFile(self.dataStore)
            .then(function () {
                Logger.d('sendReloadSignal...');
                return self.loadBalancerManager.sendReloadSignal();
            });
    }
}

module.exports = ServiceManager;
