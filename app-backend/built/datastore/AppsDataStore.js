var uuid = require('uuid/v4');
var isValidPath = require('is-valid-path');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var APP_DEFINITIONS = 'appDefinitions';
function isNameAllowed(name) {
    var isNameFormattingOk = (!!name) && (name.length < 50) && /^[a-z]/.test(name) && /[a-z0-9]$/.test(name) && /^[a-z0-9\-]+$/.test(name) && name.indexOf('--') < 0;
    return isNameFormattingOk && (['captain', 'registry'].indexOf(name) < 0);
}
var AppsDataStore = /** @class */ (function () {
    function AppsDataStore(data) {
        this.data = data;
    }
    AppsDataStore.prototype.getAppDefinitions = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(APP_DEFINITIONS) || {});
        });
    };
    AppsDataStore.prototype.getAppDefinition = function (appName) {
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            if (!appName) {
                throw new Error('App Name should not be empty');
            }
            var app = allApps[appName];
            if (!app) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, ('App could not be found ' + appName));
            }
            return app;
        });
    };
    AppsDataStore.prototype.enableSslForDefaultSubDomain = function (appName) {
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.hasDefaultSubDomainSsl = true;
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
            return true;
        });
    };
    AppsDataStore.prototype.enableCustomDomainSsl = function (appName, customDomain) {
        var self = this;
        return self.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (var idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        app.customDomain[idx].hasSsl = true;
                        self.data.set(APP_DEFINITIONS + '.' + appName, app);
                        return true;
                    }
                }
            }
            throw new Error('customDomain: ' + customDomain + ' is not attached to app ' + appName);
        });
    };
    AppsDataStore.prototype.removeCustomDomainForApp = function (appName, customDomain) {
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.customDomain = app.customDomain || [];
            var newDomains = [];
            var removed = false;
            for (var idx = 0; idx < app.customDomain.length; idx++) {
                if (app.customDomain[idx].publicDomain === customDomain) {
                    removed = true;
                }
                else {
                    newDomains.push(app.customDomain[idx]);
                }
            }
            if (!removed) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Custom domain ' + customDomain + ' does not exist in ' + appName);
            }
            app.customDomain = newDomains;
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
            return true;
        });
    };
    AppsDataStore.prototype.addCustomDomainForApp = function (appName, customDomain) {
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (var idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        throw new Error('App already has customDomain: ' + customDomain + ' attached to app ' + appName);
                    }
                }
            }
            app.customDomain.push({
                publicDomain: customDomain,
                hasSsl: false
            });
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
            return true;
        });
    };
    AppsDataStore.prototype.verifyCustomDomainBelongsToApp = function (appName, customDomain) {
        var self = this;
        return self.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (var idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        return true;
                    }
                }
            }
            throw new Error('customDomain: ' + customDomain + ' is not attached to app ' + appName);
        });
    };
    AppsDataStore.prototype.getNewVersion = function (appName) {
        if (!appName) {
            throw new Error('App Name should not be empty');
        }
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            var versions = app.versions;
            var newVersionIndex = versions.length;
            versions.push({
                version: newVersionIndex,
                gitHash: undefined,
                timeStamp: new Date()
            });
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
            return newVersionIndex;
        });
    };
    AppsDataStore.prototype.updateAppDefinitionInDb = function (appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, appPushWebhook, authenticator, customNginxConfig, preDeployFunction) {
        var self = this;
        var app;
        return Promise.resolve()
            .then(function () {
            return self.getAppDefinition(appName);
        })
            .then(function (appObj) {
            app = appObj;
        })
            .then(function () {
            if (appPushWebhook.repoInfo && appPushWebhook.repoInfo.repo && appPushWebhook.repoInfo.branch
                && appPushWebhook.repoInfo.user && appPushWebhook.repoInfo.password) {
                return authenticator
                    .getAppPushWebhookDatastore({
                    repo: appPushWebhook.repoInfo.repo,
                    branch: appPushWebhook.repoInfo.branch,
                    user: appPushWebhook.repoInfo.user,
                    password: appPushWebhook.repoInfo.password
                });
            }
            return null;
        })
            .then(function (appPushWebhookRepoInfo) {
            instanceCount = Number(instanceCount);
            if (instanceCount >= 0) {
                app.instanceCount = instanceCount;
            }
            app.notExposeAsWebApp = !!notExposeAsWebApp;
            app.forceSsl = !!forceSsl;
            app.nodeId = nodeId;
            app.customNginxConfig = customNginxConfig;
            app.preDeployFunction = preDeployFunction;
            if (app.forceSsl) {
                var hasAtLeastOneSslDomain = app.hasDefaultSubDomainSsl;
                var customDomainArray = app.customDomain;
                if (customDomainArray && customDomainArray.length > 0) {
                    for (var idx = 0; idx < customDomainArray.length; idx++) {
                        if (customDomainArray[idx].hasSsl) {
                            hasAtLeastOneSslDomain = true;
                        }
                    }
                }
                if (!hasAtLeastOneSslDomain) {
                    throw new ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, "Cannot force SSL without any SSL-enabled domain!");
                }
            }
            if (appPushWebhookRepoInfo) {
                app.appPushWebhook = app.appPushWebhook || {};
                if (!app.appPushWebhook.tokenVersion) {
                    app.appPushWebhook.tokenVersion = uuid();
                }
                app.appPushWebhook.repoInfo = appPushWebhookRepoInfo;
            }
            else {
                app.appPushWebhook = {};
            }
            if (ports) {
                var isPortValid = function (portNumber) {
                    return portNumber > 0 && portNumber < 65535;
                };
                var tempPorts = [];
                for (var i = 0; i < ports.length; i++) {
                    var obj = ports[i];
                    if (obj.containerPort && obj.hostPort) {
                        var containerPort = Number(obj.containerPort);
                        var hostPort = Number(obj.hostPort);
                        if (isPortValid(containerPort) && isPortValid(hostPort)) {
                            tempPorts.push({
                                hostPort: hostPort,
                                containerPort: containerPort
                            });
                        }
                    }
                }
                app.ports = tempPorts;
            }
            if (envVars) {
                app.envVars = [];
                for (var i = 0; i < envVars.length; i++) {
                    var obj = envVars[i];
                    if (obj.key && obj.value) {
                        app.envVars.push({
                            key: obj.key,
                            value: obj.value
                        });
                    }
                }
            }
            if (volumes) {
                app.volumes = [];
                for (var i = 0; i < volumes.length; i++) {
                    var obj = volumes[i];
                    if (obj.containerPath && (obj.volumeName || obj.hostPath)) {
                        if (obj.volumeName && obj.hostPath) {
                            throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Cannot define both host path and volume name!");
                        }
                        if (!isValidPath(obj.containerPath)) {
                            throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid containerPath: " + obj.containerPath);
                        }
                        var newVol = {
                            containerPath: obj.containerPath
                        };
                        if (obj.hostPath) {
                            if (!isValidPath(obj.hostPath)) {
                                throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid volume host path: " + obj.hostPath);
                            }
                            newVol.hostPath = obj.hostPath;
                            newVol.type = 'bind';
                        }
                        else {
                            if (!isNameAllowed(obj.volumeName)) {
                                throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid volume name: " + obj.volumeName);
                            }
                            newVol.volumeName = obj.volumeName;
                            newVol.type = 'volume';
                        }
                        app.volumes.push(newVol);
                    }
                }
            }
        })
            .then(function () {
            if (app.appPushWebhook.repoInfo) {
                return authenticator
                    .getAppPushWebhookToken(appName, app.appPushWebhook.tokenVersion);
            }
        })
            .then(function (pushWebhookToken) {
            if (pushWebhookToken) {
                app.appPushWebhook.pushWebhookToken = pushWebhookToken;
            }
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
        });
    };
    AppsDataStore.prototype.setDeployedVersion = function (appName, version) {
        if (!appName) {
            throw new Error('App Name should not be empty');
        }
        var self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            var app = allApps[appName];
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.deployedVersion = version;
            self.data.set(APP_DEFINITIONS + '.' + appName, app);
            return version;
        });
    };
    AppsDataStore.prototype.setGitHash = function (appName, newVersion, gitHashToSave) {
        if (!appName) {
            throw new Error('App Name should not be empty');
        }
        var self = this;
        return this.getAppDefinition(appName)
            .then(function (app) {
            if (!app) {
                throw new Error('App could not be found ' + appName);
            }
            app.versions = app.versions || [];
            for (var i = 0; i < app.versions.length; i++) {
                if (app.versions[i].version === newVersion) {
                    app.versions[i].gitHash = gitHashToSave;
                    self.data.set(APP_DEFINITIONS + '.' + appName, app);
                    return;
                }
            }
            Logger.e('Failed to set the git hash on the deployed version');
        });
    };
    AppsDataStore.prototype.deleteAppDefinition = function (appName) {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'App Name is not allow. Only lowercase letters and single hyphen is allow'));
                return;
            }
            if (!self.data.get(APP_DEFINITIONS + '.' + appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'App Name does not exist in Database! Cannot be deleted.'));
                return;
            }
            self.data.delete(APP_DEFINITIONS + '.' + appName);
            resolve();
        });
    };
    /**
     * Creates a new app definition.
     *
     * @param appName                   The appName you want to register
     * @param hasPersistentData         whether the app has persistent data, you can only run one instance of the app.
     * @returns {Promise}
     */
    AppsDataStore.prototype.registerAppDefinition = function (appName, hasPersistentData) {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'App Name is not allow. Only lowercase letters and single hyphen is allow'));
                return;
            }
            if (!!self.data.get(APP_DEFINITIONS + '.' + appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST, 'App Name already exists. Please use a different name'));
                return;
            }
            var defaultAppDefinition = {
                hasPersistentData: !!hasPersistentData,
                instanceCount: 1,
                networks: [CaptainConstants.captainNetworkName],
                envVars: [],
                volumes: [],
                ports: [],
                appPushWebhook: {},
                versions: []
            };
            self.data.set(APP_DEFINITIONS + '.' + appName, defaultAppDefinition);
            resolve();
        });
    };
    AppsDataStore.prototype.getAppsServerConfig = function (defaultAppNginxConfig, hasRootSsl, rootDomain) {
        var self = this;
        var apps = self.data.get(APP_DEFINITIONS) || {};
        var servers = [];
        Object.keys(apps).forEach(function (appName) {
            var webApp = apps[appName];
            if (webApp.notExposeAsWebApp) {
                return;
            }
            var localDomain = self.getServiceName(appName);
            var forceSsl = !!webApp.forceSsl;
            var nginxConfigTemplate = webApp.customNginxConfig || defaultAppNginxConfig;
            var serverWithSubDomain = {};
            serverWithSubDomain.hasSsl = hasRootSsl && webApp.hasDefaultSubDomainSsl;
            serverWithSubDomain.publicDomain = appName + '.' + rootDomain;
            serverWithSubDomain.localDomain = localDomain;
            serverWithSubDomain.forceSsl = forceSsl;
            serverWithSubDomain.nginxConfigTemplate = nginxConfigTemplate;
            servers.push(serverWithSubDomain);
            // adding custom domains
            var customDomainArray = webApp.customDomain;
            if (customDomainArray && customDomainArray.length > 0) {
                for (var idx = 0; idx < customDomainArray.length; idx++) {
                    var d = customDomainArray[idx];
                    servers.push({
                        hasSsl: d.hasSsl,
                        forceSsl: forceSsl,
                        publicDomain: d.publicDomain,
                        localDomain: localDomain,
                        nginxConfigTemplate: nginxConfigTemplate
                    });
                }
            }
        });
        return servers;
    };
    return AppsDataStore;
}());
module.exports = AppsDataStore;
