"use strict";
const uuid = require("uuid/v4");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const CaptainConstants = require("../utils/CaptainConstants");
const Logger = require("../utils/Logger");
const isValidPath = require("is-valid-path");
const APP_DEFINITIONS = "appDefinitions";
function isNameAllowed(name) {
    const isNameFormattingOk = (!!name) && (name.length < 50) && /^[a-z]/.test(name) && /[a-z0-9]$/.test(name) && /^[a-z0-9\-]+$/.test(name) && name.indexOf("--") < 0;
    return isNameFormattingOk && (["captain", "registry"].indexOf(name) < 0);
}
class AppsDataStore {
    constructor(data, namepace) {
        this.data = data;
        this.namepace = namepace;
    }
    getServiceName(appName) {
        return "srv-" + this.namepace + "--" + appName;
    }
    getAppDefinitions() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(APP_DEFINITIONS) || {});
        });
    }
    getAppDefinition(appName) {
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            if (!appName) {
                throw new Error("App Name should not be empty");
            }
            const app = allApps[appName];
            if (!app) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, ("App could not be found " + appName));
            }
            return app;
        });
    }
    enableSslForDefaultSubDomain(appName) {
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.hasDefaultSubDomainSsl = true;
            self.data.set(APP_DEFINITIONS + "." + appName, app);
            return true;
        });
    }
    enableCustomDomainSsl(appName, customDomain) {
        const self = this;
        return self.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        app.customDomain[idx].hasSsl = true;
                        self.data.set(APP_DEFINITIONS + "." + appName, app);
                        return true;
                    }
                }
            }
            throw new Error("customDomain: " + customDomain + " is not attached to app " + appName);
        });
    }
    removeCustomDomainForApp(appName, customDomain) {
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.customDomain = app.customDomain || [];
            const newDomains = [];
            let removed = false;
            for (let idx = 0; idx < app.customDomain.length; idx++) {
                if (app.customDomain[idx].publicDomain === customDomain) {
                    removed = true;
                }
                else {
                    newDomains.push(app.customDomain[idx]);
                }
            }
            if (!removed) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Custom domain " + customDomain + " does not exist in " + appName);
            }
            app.customDomain = newDomains;
            self.data.set(APP_DEFINITIONS + "." + appName, app);
            return true;
        });
    }
    addCustomDomainForApp(appName, customDomain) {
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        throw new Error("App already has customDomain: " + customDomain + " attached to app " + appName);
                    }
                }
            }
            app.customDomain.push({
                publicDomain: customDomain,
                hasSsl: false
            });
            self.data.set(APP_DEFINITIONS + "." + appName, app);
            return true;
        });
    }
    verifyCustomDomainBelongsToApp(appName, customDomain) {
        const self = this;
        return self.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.customDomain = app.customDomain || [];
            if (app.customDomain.length > 0) {
                for (let idx = 0; idx < app.customDomain.length; idx++) {
                    if (app.customDomain[idx].publicDomain === customDomain) {
                        return true;
                    }
                }
            }
            throw new Error("customDomain: " + customDomain + " is not attached to app " + appName);
        });
    }
    getNewVersion(appName) {
        if (!appName) {
            throw new Error("App Name should not be empty");
        }
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            const versions = app.versions;
            const newVersionIndex = versions.length;
            versions.push({
                version: newVersionIndex,
                gitHash: undefined,
                timeStamp: new Date().toString()
            });
            self.data.set(APP_DEFINITIONS + "." + appName, app);
            return newVersionIndex;
        });
    }
    updateAppDefinitionInDb(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, forceSsl, ports, appPushWebhook, authenticator, customNginxConfig, preDeployFunction) {
        const self = this;
        let app;
        return Promise.resolve()
            .then(function () {
            return self.getAppDefinition(appName);
        })
            .then(function (appObj) {
            app = appObj;
        })
            .then(function () {
            if (appPushWebhook.repoInfo && appPushWebhook.repoInfo.repo && appPushWebhook.repoInfo.branch &&
                appPushWebhook.repoInfo.user && appPushWebhook.repoInfo.password) {
                return authenticator
                    .getAppPushWebhookDatastore({
                    repo: appPushWebhook.repoInfo.repo,
                    branch: appPushWebhook.repoInfo.branch,
                    user: appPushWebhook.repoInfo.user,
                    password: appPushWebhook.repoInfo.password
                });
            }
            return Promise.resolve(undefined);
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
                let hasAtLeastOneSslDomain = app.hasDefaultSubDomainSsl;
                const customDomainArray = app.customDomain;
                if (customDomainArray && customDomainArray.length > 0) {
                    for (let idx = 0; idx < customDomainArray.length; idx++) {
                        if (customDomainArray[idx].hasSsl) {
                            hasAtLeastOneSslDomain = true;
                        }
                    }
                }
                if (!hasAtLeastOneSslDomain) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, "Cannot force SSL without any SSL-enabled domain!");
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
                const isPortValid = function (portNumber) {
                    return portNumber > 0 && portNumber < 65535;
                };
                const tempPorts = [];
                for (let i = 0; i < ports.length; i++) {
                    const obj = ports[i];
                    if (obj.containerPort && obj.hostPort) {
                        const containerPort = Number(obj.containerPort);
                        const hostPort = Number(obj.hostPort);
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
                for (let i = 0; i < envVars.length; i++) {
                    const obj = envVars[i];
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
                for (let i = 0; i < volumes.length; i++) {
                    const obj = volumes[i];
                    if (obj.containerPath && (obj.volumeName || obj.hostPath)) {
                        if (obj.volumeName && obj.hostPath) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Cannot define both host path and volume name!");
                        }
                        if (!isValidPath(obj.containerPath)) {
                            throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid containerPath: " + obj.containerPath);
                        }
                        const newVol = {
                            containerPath: obj.containerPath
                        };
                        if (obj.hostPath) {
                            if (!isValidPath(obj.hostPath)) {
                                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid volume host path: " + obj.hostPath);
                            }
                            newVol.hostPath = obj.hostPath;
                            newVol.type = "bind";
                        }
                        else {
                            if (!isNameAllowed(obj.volumeName)) {
                                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid volume name: " + obj.volumeName);
                            }
                            newVol.volumeName = obj.volumeName;
                            newVol.type = "volume";
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
            return Promise.resolve(undefined);
        })
            .then(function (pushWebhookToken) {
            if (pushWebhookToken) {
                app.appPushWebhook.pushWebhookToken = pushWebhookToken;
            }
            self.data.set(APP_DEFINITIONS + "." + appName, app);
        });
    }
    setDeployedVersion(appName, version) {
        if (!appName) {
            throw new Error("App Name should not be empty");
        }
        const self = this;
        return this.getAppDefinitions()
            .then(function (allApps) {
            const app = allApps[appName];
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.deployedVersion = version;
            self.data.set(APP_DEFINITIONS + "." + appName, app);
            return version;
        });
    }
    setGitHash(appName, newVersion, gitHashToSave) {
        if (!appName) {
            throw new Error("App Name should not be empty");
        }
        const self = this;
        return this.getAppDefinition(appName)
            .then(function (app) {
            if (!app) {
                throw new Error("App could not be found " + appName);
            }
            app.versions = app.versions || [];
            for (let i = 0; i < app.versions.length; i++) {
                if (app.versions[i].version === newVersion) {
                    app.versions[i].gitHash = gitHashToSave;
                    self.data.set(APP_DEFINITIONS + "." + appName, app);
                    return;
                }
            }
            Logger.e("Failed to set the git hash on the deployed version");
        });
    }
    deleteAppDefinition(appName) {
        const self = this;
        return new Promise(function (resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, "App Name is not allow. Only lowercase letters and single hyphen is allow"));
                return;
            }
            if (!self.data.get(APP_DEFINITIONS + "." + appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "App Name does not exist in Database! Cannot be deleted."));
                return;
            }
            self.data.delete(APP_DEFINITIONS + "." + appName);
            resolve();
        });
    }
    /**
     * Creates a new app definition.
     *
     * @param appName                   The appName you want to register
     * @param hasPersistentData         whether the app has persistent data, you can only run one instance of the app.
     * @returns {Promise}
     */
    registerAppDefinition(appName, hasPersistentData) {
        const self = this;
        return new Promise(function (resolve, reject) {
            if (!isNameAllowed(appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, "App Name is not allow. Only lowercase letters and single hyphen is allow"));
                return;
            }
            if (!!self.data.get(APP_DEFINITIONS + "." + appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST, "App Name already exists. Please use a different name"));
                return;
            }
            const defaultAppDefinition = {
                hasPersistentData: !!hasPersistentData,
                instanceCount: 1,
                networks: [CaptainConstants.captainNetworkName],
                envVars: [],
                volumes: [],
                ports: [],
                appPushWebhook: {},
                versions: []
            };
            self.data.set(APP_DEFINITIONS + "." + appName, defaultAppDefinition);
            resolve();
        });
    }
    getAppsServerConfig(defaultAppNginxConfig, hasRootSsl, rootDomain) {
        const self = this;
        const apps = self.data.get(APP_DEFINITIONS) || {};
        const servers = [];
        Object.keys(apps).forEach(function (appName) {
            const webApp = apps[appName];
            if (webApp.notExposeAsWebApp) {
                return;
            }
            const localDomain = self.getServiceName(appName);
            const forceSsl = !!webApp.forceSsl;
            const nginxConfigTemplate = webApp.customNginxConfig || defaultAppNginxConfig;
            const serverWithSubDomain = {};
            serverWithSubDomain.hasSsl = hasRootSsl && webApp.hasDefaultSubDomainSsl;
            serverWithSubDomain.publicDomain = appName + "." + rootDomain;
            serverWithSubDomain.localDomain = localDomain;
            serverWithSubDomain.forceSsl = forceSsl;
            serverWithSubDomain.nginxConfigTemplate = nginxConfigTemplate;
            servers.push(serverWithSubDomain);
            // adding custom domains
            const customDomainArray = webApp.customDomain;
            if (customDomainArray && customDomainArray.length > 0) {
                for (let idx = 0; idx < customDomainArray.length; idx++) {
                    const d = customDomainArray[idx];
                    servers.push({
                        hasSsl: d.hasSsl,
                        forceSsl: forceSsl,
                        publicDomain: d.publicDomain,
                        localDomain: localDomain,
                        nginxConfigTemplate: nginxConfigTemplate,
                        staticWebRoot: ""
                    });
                }
            }
        });
        return servers;
    }
}
module.exports = AppsDataStore;
//# sourceMappingURL=AppsDataStore.js.map