var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var fs = require('fs-extra');
var tar = require('tar');
var path = require('path');
var CaptainManager = require('./CaptainManager');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var TemplateHelper = require('./TemplateHelper');
var Authenticator = require('./Authenticator');
var GitHelper = require('../utils/GitHelper');
var uuid = require('uuid/v4');
var requireFromString = require('require-from-string');
var BUILD_LOG_SIZE = 50;
var SOURCE_FOLDER_NAME = 'src';
var DOCKER_FILE = 'Dockerfile';
var CAPTAIN_DEFINITION_FILE = 'captain-definition';
var PLACEHOLDER_DOCKER_FILE_CONTENT = 'FROM ' + CaptainConstants.appPlaceholderImageName
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
var BuildLog = /** @class */ (function () {
    function BuildLog(size) {
        this.size = size;
        this.clear();
    }
    BuildLog.prototype.onBuildFailed = function (error) {
        this.log('----------------------');
        this.log('Deploy failed!');
        this.log(error);
        this.isBuildFailed = true;
    };
    BuildLog.prototype.clear = function () {
        this.isBuildFailed = false;
        this.firstLineNumber = -this.size;
        this.lines = [];
        for (var i = 0; i < this.size; i++) {
            this.lines.push('');
        }
    };
    BuildLog.prototype.log = function (msg) {
        msg = (msg || '') + '';
        this.lines.shift();
        this.lines.push(msg);
        this.firstLineNumber++;
        Logger.dev(msg);
    };
    BuildLog.prototype.getLogs = function () {
        var self = this;
        // if we don't copy the object, "lines" can get changed but firstLineNumber stay as is, causing bug!
        return JSON.parse(JSON.stringify({
            lines: self.lines,
            firstLineNumber: self.firstLineNumber
        }));
    };
    return BuildLog;
}());
var ServiceManager = /** @class */ (function () {
    function ServiceManager(user, dockerApi, loadBalancerManager) {
        this.user = user;
        this.dataStore = user.dataStore;
        this.dockerApi = dockerApi;
        this.loadBalancerManager = loadBalancerManager;
        this.activeBuilds = {};
        this.buildLogs = {};
        this.isReady = true;
    }
    ServiceManager.prototype.isInited = function () {
        return this.isReady;
    };
    ServiceManager.prototype.createTarFarFromCaptainContent = function (captainDefinitionContent, appName, tarDestination) {
        var serviceName = this.dataStore.getServiceName(appName);
        var captainDefinitionDirPath;
        return Promise.resolve()
            .then(function () {
            for (var i = 0; i < 100; i++) {
                var temp = getCaptainDefinitionTempFolder(serviceName, uuid());
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
    };
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
    ServiceManager.prototype.createImage = function (appName, source, gitHash) {
        Logger.d('Creating image for: ' + appName);
        var self = this;
        var imageName = this.dataStore.getImageName(CaptainManager.get().getDockerAuthObject(), appName);
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
        var newVersion = null;
        var rawImageSourceFolder = null;
        var rawImageBaseFolder = null;
        var tarImageBaseFolder = null;
        var tarballFilePath = null;
        var dockerFilePath = null;
        this.activeBuilds[appName] = true;
        this.buildLogs[appName] = this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        this.buildLogs[appName].clear();
        this.buildLogs[appName].log('------------------------- ' + (new Date()));
        this.buildLogs[appName].log('Build started for ' + appName);
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getNewVersion(appName);
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
                return rawImageSourceFolder;
            });
        })
            .then(function (rawImageSourceFolder) {
            var promiseToFetchDirectory = null;
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
                var repoInfo = source.repoInfo;
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
                return dataStore.getAppsDataStore().setGitHash(appName, newVersion, gitHashToSave);
            })
                .then(function () {
                return fs.pathExists(rawImageSourceFolder + '/' + CAPTAIN_DEFINITION_FILE);
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
                    var directoryInside_1 = null;
                    return new Promise(function (resolve, reject) {
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
                        directoryInside_1 = directory;
                        return fs.pathExists(path.join(path.join(rawImageSourceFolder, directoryInside_1), CAPTAIN_DEFINITION_FILE));
                    })
                        .then(function (captainDefinitionExists) {
                        if (!captainDefinitionExists) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Captain Definition file does not exist!");
                        }
                        var BAK = '.bak';
                        fs.renameSync(rawImageSourceFolder, rawImageSourceFolder + BAK);
                        fs.renameSync(path.join(rawImageSourceFolder + BAK, directoryInside_1), rawImageSourceFolder);
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
                    var templateIdTag = data.templateId;
                    var dockerfileLines = data.dockerfileLines;
                    var hasDockerfileLines = dockerfileLines && dockerfileLines.length > 0;
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
                .buildImageFromDockerFile(imageName, newVersion, tarballFilePath, self.buildLogs[appName])
                .catch(function (error) {
                throw ApiStatusCodes.createError(ApiStatusCodes.BUILD_ERROR, ('' + error).trim());
            });
        })
            .then(function () {
            Logger.d('Cleaning up up the files... ' + tarImageBaseFolder + '  and  ' + rawImageBaseFolder);
            return fs.remove(tarImageBaseFolder);
        })
            .then(function () {
            return fs.remove(rawImageBaseFolder);
        })
            .then(function () {
            var authObj = CaptainManager.get().getDockerAuthObject();
            if (!authObj) {
                Logger.d('No Docker Auth is found. Skipping pushing the image.');
                return true;
            }
            Logger.d('Docker Auth is found. Pushing the image...');
            return dockerApi
                .pushImage(imageName, newVersion, authObj, self.buildLogs[appName])
                .catch(function (error) {
                return new Promise(function (resolve, reject) {
                    Logger.e('PUSH FAILED');
                    Logger.e(error);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Push failed: ' + error));
                });
            });
        })
            .then(function () {
            self.activeBuilds[appName] = false;
            return newVersion;
        })
            .catch(function (error) {
            self.activeBuilds[appName] = false;
            return new Promise(function (resolve, reject) {
                reject(error);
            });
        });
    };
    ServiceManager.prototype.enableCustomDomainSsl = function (appName, customDomain) {
        var self = this;
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
            return self.dataStore.getAppsDataStore().verifyCustomDomainBelongsToApp(appName, customDomain);
        })
            .then(function () {
            return CaptainManager.get().requestCertificateForDomain(customDomain);
        })
            .then(function () {
            return self.dataStore.getAppsDataStore().enableCustomDomainSsl(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.addCustomDomain = function (appName, customDomain) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            var rootDomain = self.dataStore.getRootDomain();
            var dotRootDomain = "." + rootDomain;
            if (!customDomain || !(/^[a-z0-9\-\.]+$/.test(customDomain))) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca');
            }
            if (customDomain.length > 80) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Please use alphanumerical domains less than 80 characters in length.');
            }
            if (customDomain.indexOf('..') >= 0) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. You cannot have two consecutive periods ".." inside a domain name. Please use alphanumerical domains such as myapp.google123.ca');
            }
            if (customDomain.indexOf(dotRootDomain) >= 0
                && (customDomain.indexOf(dotRootDomain) + dotRootDomain.length) === customDomain.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'Domain name is not accepted. Custom domain cannot be subdomain of root domain.');
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
            return self.dataStore.getAppsDataStore().addCustomDomainForApp(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.removeCustomDomain = function (appName, customDomain) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            if (!appName) {
                throw new Error('No App Name! Cannot verify domain');
            }
            Logger.d('Removing custom domain for: ' + appName);
            return self.dataStore.getAppsDataStore().removeCustomDomainForApp(appName, customDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.enableSslForApp = function (appName) {
        var self = this;
        var rootDomain = null;
        var app = null;
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
            // it will ensure that the app exists, otherwise it throws an exception
            return self.dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function () {
            return appName + '.' + rootDomain;
        })
            .then(function (domainName) {
            return CaptainManager.get().requestCertificateForDomain(domainName);
        })
            .then(function () {
            return self.dataStore.getAppsDataStore().enableSslForDefaultSubDomain(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.verifyCaptainOwnsGenericSubDomain = function (appName) {
        var self = this;
        var rootDomain = null;
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
            // it will ensure that the app exists, otherwise it throws an exception
            return self.dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function () {
            return appName + '.' + rootDomain;
        })
            .then(function (domainName) {
            Logger.d('Verifying Captain owns domain: ' + domainName);
            return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(domainName);
        });
    };
    ServiceManager.prototype.removeApp = function (appName) {
        Logger.d('Removing service for: ' + appName);
        var self = this;
        var serviceName = this.dataStore.getServiceName(appName);
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
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
            return dataStore.getAppsDataStore().deleteAppDefinition(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.getUnusedImages = function (mostRecentLimit) {
        Logger.d('Getting unused images, excluding most recent ones: ' + mostRecentLimit);
        var self = this;
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
        var allImages = null;
        return Promise.resolve()
            .then(function () {
            return dockerApi
                .getImages();
        })
            .then(function (images) {
            allImages = images;
            return dataStore.getAppsDataStore().getAppDefinitions();
        })
            .then(function (apps) {
            var unusedImages = [];
            var _loop_1 = function (i) {
                var img = allImages[i];
                var imageInUse = false;
                if (img.RepoTags) {
                    var _loop_2 = function (j) {
                        var repoTag = img.RepoTags[j];
                        Object.keys(apps).forEach(function (key, index) {
                            var app = apps[key];
                            app.appName = key;
                            for (var k = 0; k < (mostRecentLimit + 1); k++) {
                                if (repoTag.indexOf(dataStore.getImageNameWithoutAuthObj(app.appName, Number(app.deployedVersion) - k)) >= 0) {
                                    imageInUse = true;
                                }
                            }
                        });
                    };
                    for (var j = 0; j < img.RepoTags.length; j++) {
                        _loop_2(j);
                    }
                }
                if (!imageInUse) {
                    unusedImages.push({
                        id: img.Id,
                        description: (img.RepoTags && img.RepoTags.length) ? img.RepoTags[0] : 'untagged'
                    });
                }
            };
            for (var i = 0; i < allImages.length; i++) {
                _loop_1(i);
            }
            return unusedImages;
        });
    };
    ServiceManager.prototype.deleteImages = function (imageIds) {
        Logger.d('Deleting images...');
        var self = this;
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
        var allImages = null;
        return Promise.resolve()
            .then(function () {
            return dockerApi
                .deleteImages(imageIds);
        });
    };
    ServiceManager.prototype.ensureServiceInitedAndUpdated = function (appName, version) {
        Logger.d('Ensure service inited and Updated for: ' + appName);
        var self = this;
        var serviceName = this.dataStore.getServiceName(appName);
        var dockerAuthObject = CaptainManager.get().getDockerAuthObject();
        var imageName = this.dataStore.getImageName(dockerAuthObject, appName, version);
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
        var app = null;
        return dataStore.getAppsDataStore().setDeployedVersion(appName, version)
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (appFound) {
            app = appFound;
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
            return self.createPreDeployFunctionIfExist(app);
        })
            .then(function (preDeployFunction) {
            Logger.d('Updating service: ' + serviceName + ' with image: ' + imageName);
            return dockerApi
                .updateService(serviceName, imageName, app.volumes, app.networks, app.envVars, null, dockerAuthObject, Number(app.instanceCount), app.nodeId, dataStore.getNameSpace(), app, preDeployFunction);
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
    };
    ServiceManager.prototype.createPreDeployFunctionIfExist = function (app) {
        var preDeployFunction = app.preDeployFunction;
        if (!preDeployFunction) {
            return null;
        }
        /*
        ////////////////////////////////// Expected content of the file //////////////////////////

            const uuid = require('uuid/v4');
            console.log('-------------------------------'+uuid());

            preDeployFunction = function (captainAppObj, dockerUpdateObject) {
                return Promise.resolve()
                        .then(function(){
                            console.log(JSON.stringify(dockerUpdateObject));
                            return dockerUpdateObject;
                        });
            };
         */
        preDeployFunction = preDeployFunction + '\n\n module.exports = preDeployFunction';
        return requireFromString(preDeployFunction);
    };
    ServiceManager.prototype.updateAppDefinition = function (appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, appPushWebhook, customNginxConfig, preDeployFunction) {
        var self = this;
        var dataStore = this.dataStore;
        var dockerApi = this.dockerApi;
        var serviceName = null;
        var checkIfNodeIdExists = function (nodeIdToCheck) {
            return dockerApi
                .getNodesInfo()
                .then(function (nodeInfo) {
                for (var i = 0; i < nodeInfo.length; i++) {
                    if (nodeIdToCheck === nodeInfo[i].nodeId) {
                        return;
                    }
                }
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Node ID you requested in not part of the swarm " + nodeIdToCheck);
            });
        };
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (app) {
            serviceName = dataStore.getServiceName(appName);
            // After leaving this block, nodeId will be guaranteed to be NonNull
            if (app.hasPersistentData) {
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
            return dataStore.getAppsDataStore().updateAppDefinitionInDb(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, appPushWebhook, Authenticator.get(dataStore.getNameSpace()), customNginxConfig, preDeployFunction);
        })
            .then(function () {
            return self.updateServiceOnDefinitionUpdate(appName);
        })
            .then(function () {
            return self.reloadLoadBalancer();
        });
    };
    ServiceManager.prototype.isAppBuilding = function (appName) {
        return !!this.activeBuilds[appName];
    };
    /**
     *
     * @returns the active build that it finds
     */
    ServiceManager.prototype.isAnyBuildRunning = function () {
        var activeBuilds = this.activeBuilds;
        for (var appName in activeBuilds) {
            if (!!activeBuilds[appName]) {
                return appName;
            }
        }
        return null;
    };
    ServiceManager.prototype.getBuildStatus = function (appName) {
        var self = this;
        this.buildLogs[appName] = this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        return {
            isAppBuilding: self.isAppBuilding(appName),
            logs: self.buildLogs[appName].getLogs(),
            isBuildFailed: self.buildLogs[appName].isBuildFailed
        };
    };
    ServiceManager.prototype.logBuildFailed = function (appName, error) {
        error = (error || '') + '';
        this.buildLogs[appName] = this.buildLogs[appName] || new BuildLog(BUILD_LOG_SIZE);
        this.buildLogs[appName].onBuildFailed(error);
    };
    ServiceManager.prototype.updateServiceOnDefinitionUpdate = function (appName) {
        var self = this;
        var serviceName = this.dataStore.getServiceName(appName);
        var dockerAuthObject = CaptainManager.get().getDockerAuthObject();
        var dataStore = this.dataStore;
        var dockerApi = this.dockerApi;
        var appFound = null;
        return Promise.resolve()
            .then(function () {
            return dataStore.getAppsDataStore().getAppDefinition(appName);
        })
            .then(function (app) {
            appFound = app;
            if (!appFound) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name not found!');
            }
            return self.createPreDeployFunctionIfExist(app);
        })
            .then(function (preDeployFunction) {
            if (!appFound) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App name not found!');
            }
            return dockerApi
                .updateService(serviceName, null, appFound.volumes, appFound.networks, appFound.envVars, null, dockerAuthObject, Number(appFound.instanceCount), appFound.nodeId, dataStore.getNameSpace(), appFound.ports, appFound, preDeployFunction);
        });
    };
    ServiceManager.prototype.reloadLoadBalancer = function () {
        Logger.d('Updating Load Balancer');
        var self = this;
        return self.loadBalancerManager.rePopulateNginxConfigFile(self.dataStore)
            .then(function () {
            Logger.d('sendReloadSignal...');
            return self.loadBalancerManager.sendReloadSignal();
        });
    };
    return ServiceManager;
}());
module.exports = ServiceManager;
