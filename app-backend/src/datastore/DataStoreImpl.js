/**
 * Created by kasra on 27/06/17.
 */
const Configstore = require('configstore');
const uuid = require('uuid/v4');
const isValidPath = require('is-valid-path');
const fs = require('fs-extra');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const CaptainConstants = require('../utils/CaptainConstants');
const Logger = require('../utils/Logger');

const dockerfilesRoot = __dirname + '/../dockerfiles/';

const NAMESPACE = 'namespace';
const HASHED_PASSWORD = 'hashedPassword';
const CAPTAIN_REGISTRY_AUTH_SECRET_VER = 'captainRegistryAuthSecretVer';
const CUSTOM_DOMAIN = 'customDomain';
const HAS_ROOT_SSL = 'hasRootSsl';
const FORCE_ROOT_SSL = 'forceRootSsl';
const HAS_REGISTRY_SSL = 'hasRegistrySsl';
const HAS_LOCAL_REGISTRY = 'hasLocalRegistry';
const APP_DEFINITIONS = 'appDefinitions';
const EMAIL_ADDRESS = 'emailAddress';
const NET_DATA_INFO = 'netDataInfo';
const DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost';


function isNameAllowed(name) {
    return (!!name) && (name.length < 50) && /^[a-z]/.test(name) && /[a-z0-9]$/.test(name) && /^[a-z0-9\-]+$/.test(name) && name.indexOf('--') < 0;
}

class DataStore {

    constructor(namespace) {

        let data = new Configstore('captain-store', {});
        data.path = CaptainConstants.captainRootDirectory + '/config.conf';

        this.data = data;
        this.data.set(NAMESPACE, namespace);
    }

    getNameSpace() {
        return this.data.get(NAMESPACE);
    }

    setHashedPassword(newHashedPassword) {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.data.set(HASHED_PASSWORD, newHashedPassword)
            });
    }

    getHashedPassword() {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.data.get(HASHED_PASSWORD)
            });
    }

    /*
			"smtp": {
				"to": "",
				"hostname": "",
				"server": "",
				"port": "",
				"allowNonTls": false,
				"password": "",
				"username": ""
			},
			"slack": {
				"hook": "",
				"channel": ""
			},
			"telegram": {
				"botToken": "",
				"chatId": ""
			},
			"pushBullet": {
				"fallbackEmail": "",
				"apiToken": ""
			}
     */
    getNetDataInfo() {
        const self = this;
        return Promise.resolve()
            .then(function () {
                let netDataInfo = self.data.get(NET_DATA_INFO) || {};
                netDataInfo.isEnabled = netDataInfo.isEnabled || false;
                netDataInfo.data = netDataInfo.data || {};
                return netDataInfo;
            });
    }

    setNetDataInfo(netDataInfo) {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.data.set(NET_DATA_INFO, netDataInfo)
            });
    }

    setRegistryAuthSecretVersion(ver) {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.data.set(CAPTAIN_REGISTRY_AUTH_SECRET_VER, Number(ver))
            });
    }

    getRegistryAuthSecretVersion() {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return (self.data.get(CAPTAIN_REGISTRY_AUTH_SECRET_VER) || 0);
            });
    }

    getServiceName(appName) {
        return 'srv-' + this.getNameSpace() + '--' + appName;
    }

    getImageName(authObj, appName, version) {

        let authPrefix = '';

        if (authObj) {
            authPrefix = authObj.serveraddress + '/';
        }

        return authPrefix + 'img-' + this.getNameSpace() + '--' + appName + (version ? (':' + version) : '');
    }

    getRootDomain() {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN;
    }

    hasCustomDomain() {
        return !!this.data.get(CUSTOM_DOMAIN);
    }

    enableSslForDefaultSubDomain(appName) {

        const self = this;

        return this.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.hasDefaultSubDomainSsl = true;

                self.data.set(APP_DEFINITIONS + '.' + appName, app);

                return true;

            });
    }

    verifyCustomDomainBelongsToApp(appName, customDomain) {
        const self = this;

        return self.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.customDomain = app.customDomain || [];

                if (app.customDomain.length > 0) {
                    for (let idx = 0; idx < app.customDomain.length; idx++) {
                        if (app.customDomain[idx].publicDomain === customDomain) {
                            return true;
                        }
                    }
                }

                throw new Error('customDomain: ' + customDomain + ' is not attached to app ' + appName);

            });
    }

    enableCustomDomainSsl(appName, customDomain) {

        const self = this;

        return self.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.customDomain = app.customDomain || [];

                if (app.customDomain.length > 0) {
                    for (let idx = 0; idx < app.customDomain.length; idx++) {
                        if (app.customDomain[idx].publicDomain === customDomain) {
                            app.customDomain[idx].hasSsl = true;
                            self.data.set(APP_DEFINITIONS + '.' + appName, app);
                            return true;
                        }
                    }
                }

                throw new Error('customDomain: ' + customDomain + ' is not attached to app ' + appName);

            });
    }

    removeCustomDomainForApp(appName, customDomain) {

        const self = this;

        return this.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
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
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Custom domain ' + customDomain + ' does not exist in ' + appName);
                }

                app.customDomain = newDomains;

                self.data.set(APP_DEFINITIONS + '.' + appName, app);

                return true;

            });
    }

    addCustomDomainForApp(appName, customDomain) {

        const self = this;

        return this.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.customDomain = app.customDomain || [];

                if (app.customDomain.length > 0) {
                    for (let idx = 0; idx < app.customDomain.length; idx++) {
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
    }

    getServerList() {

        const self = this;

        let hasRootSsl = null;
        let rootDomain = null;

        return Promise.resolve()
            .then(function () {

                return self.getHasRootSsl();

            })
            .then(function (val) {

                hasRootSsl = val;

                return self.getRootDomain();

            })
            .then(function (val) {

                rootDomain = val;

            })
            .then(function () {

                let apps = self.data.get(APP_DEFINITIONS) || {};
                let servers = [];

                Object.keys(apps).forEach(function (appName) {

                    let webApp = apps[appName];

                    if (webApp.notExposeAsWebApp) {
                        return;
                    }

                    let localDomain = self.getServiceName(appName);

                    let serverWithSubDomain = {};
                    serverWithSubDomain.hasSsl = hasRootSsl && webApp.hasDefaultSubDomainSsl;
                    serverWithSubDomain.publicDomain = appName + '.' + rootDomain;
                    serverWithSubDomain.localDomain = localDomain;

                    servers.push(serverWithSubDomain);

                    // adding custom domains
                    let customDomainArray = webApp.customDomain;
                    if (customDomainArray && customDomainArray.length > 0) {
                        for (let idx = 0; idx < customDomainArray.length; idx++) {
                            let d = customDomainArray[idx];
                            servers.push({
                                hasSsl: d.hasSsl,
                                publicDomain: d.publicDomain,
                                localDomain: localDomain
                            });

                        }
                    }


                });

                return servers;
            });
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
                    throw new Error('App Name should not be empty');
                }

                let app = allApps[appName];

                if (!app) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, ('App could not be found ' + appName));
                }

                return app;

            });
    }

    updateAppDefinitionInDb(appName, instanceCount, envVars, volumes, nodeId, notExposeAsWebApp, ports, appPushWebhook, authenticator) {
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

                if (appPushWebhook.repoInfo && appPushWebhook.repoInfo.repo && appPushWebhook.repoInfo.branch
                    && appPushWebhook.repoInfo.user && appPushWebhook.repoInfo.password) {
                    return authenticator
                        .getAppPushWebhookDatastore({
                            repo: appPushWebhook.repoInfo.repo,
                            branch: appPushWebhook.repoInfo.branch,
                            user: appPushWebhook.repoInfo.user,
                            password: appPushWebhook.repoInfo.password
                        })
                }

                return null;

            })
            .then(function (appPushWebhookRepoInfo) {

                instanceCount = Number(instanceCount);
			
		if (instanceCount >= 0) {
			app.instanceCount = instanceCount;
		}

                
                app.notExposeAsWebApp = !!notExposeAsWebApp;
                app.nodeId = nodeId;

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

                    function isPortValid(portNumber) {
                        return portNumber > 0 && portNumber < 65535;
                    }

                    let tempPorts = [];
                    for (let i = 0; i < ports.length; i++) {
                        let obj = ports[i];
                        if (obj.containerPort && obj.hostPort) {

                            let containerPort = Number(obj.containerPort);
                            let hostPort = Number(obj.hostPort);

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
                        let obj = envVars[i];
                        if (obj.key && obj.value) {
                            app.envVars.push({
                                key: obj.key,
                                value: obj.value
                            })
                        }
                    }
                }

                if (volumes) {

                    for (let i = 0; i < volumes.length; i++) {
                        let obj = volumes[i];
                        if (obj.containerPath && obj.volumeName) {
                            if (!isNameAllowed(obj.volumeName)) {
                                throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid volume name: " + obj.volumeName);
                            }
                            if (!isValidPath(obj.containerPath)) {
                                throw new ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "Invalid containerPath: " + obj.containerPath);
                            }
                        }
                    }

                    app.volumes = [];

                    for (let i = 0; i < volumes.length; i++) {
                        let obj = volumes[i];
                        if (obj.containerPath && obj.volumeName) {
                            app.volumes.push({
                                containerPath: obj.containerPath,
                                volumeName: obj.volumeName,
                                type: 'volume'
                            });
                        }
                    }
                }

            })
            .then(function () {

                if (app.appPushWebhook.repoInfo) {
                    return authenticator
                        .getAppPushWebhookToken(appName, app.appPushWebhook.tokenVersion)
                }

            })
            .then(function (pushWebhookToken) {

                if (pushWebhookToken) {
                    app.appPushWebhook.pushWebhookToken = pushWebhookToken;
                }

                self.data.set(APP_DEFINITIONS + '.' + appName, app);

            });
    }

    setUserEmailAddress(emailAddress) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(EMAIL_ADDRESS, emailAddress);
            resolve();

        });

    }

    getUserEmailAddress() {

        const self = this;

        return new Promise(function (resolve, reject) {

            resolve(self.data.get(EMAIL_ADDRESS));

        });
    }

    setHasRootSsl(hasRootSsl) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(HAS_ROOT_SSL, hasRootSsl);
            resolve();

        });
    }

    setForceSsl(forceSsl) {
        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(FORCE_ROOT_SSL, forceSsl);
            resolve();

        });
    }

    getForceSsl() {

        const self = this;

        return new Promise(function (resolve, reject) {

            resolve(self.data.get(FORCE_ROOT_SSL));

        });
    }

    setHasRegistrySsl(hasRegistrySsl) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(HAS_REGISTRY_SSL, hasRegistrySsl);
            resolve();

        });
    }

    getHasRootSsl() {

        const self = this;

        return new Promise(function (resolve, reject) {

            resolve(self.data.get(HAS_ROOT_SSL));

        });
    }

    setHasLocalRegistry(hasLocalRegistry) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(HAS_LOCAL_REGISTRY, hasLocalRegistry);
            resolve();

        });
    }

    getHasLocalRegistry() {
        const self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(HAS_LOCAL_REGISTRY));
        });
    }

    getHasRegistrySsl() {

        const self = this;

        return new Promise(function (resolve, reject) {

            resolve(self.data.get(HAS_REGISTRY_SSL));

        });
    }

    setCustomDomain(customDomain) {

        const self = this;

        return new Promise(function (resolve, reject) {

            self.data.set(CUSTOM_DOMAIN, customDomain);
            resolve();

        });
    }

    setDeployedVersion(appName, version) {

        if (!appName) {
            throw new Error('App Name should not be empty');
        }
        const self = this;

        return this.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.deployedVersion = version;

                self.data.set(APP_DEFINITIONS + '.' + appName, app);

                return version;

            });
    }

    setGitHash(appName, newVersion, gitHashToSave) {

        if (!appName) {
            throw new Error('App Name should not be empty');
        }

        const self = this;

        return this.getAppDefinition(appName)
            .then(function (app) {

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                app.versions = app.versions || [];


                for (let i = 0; i < app.versions.length; i++) {
                    if (app.versions[i].version === newVersion) {
                        app.versions[i].gitHash = gitHashToSave;
                        self.data.set(APP_DEFINITIONS + '.' + appName, app);
                        return;
                    }
                }

                Logger.e('Failed to set the git hash on the deployed version');


            });

    }

    getNewVersion(appName) {

        if (!appName) {
            throw new Error('App Name should not be empty');
        }
        const self = this;

        return this.getAppDefinitions()
            .then(function (allApps) {

                let app = allApps[appName];

                if (!app) {
                    throw new Error('App could not be found ' + appName);
                }

                let versions = app.versions;
                let newVersionIndex = versions.length;

                versions.push({
                    version: newVersionIndex,
                    gitHash: undefined,
                    timeStamp: new Date()
                });

                self.data.set(APP_DEFINITIONS + '.' + appName, app);

                return newVersionIndex;

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
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_BAD_NAME, 'App Name is not allow. Only lowercase letters and single hyphen is allow'));
                return;
            }

            if (!!self.data.get(APP_DEFINITIONS + '.' + appName)) {
                reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST, 'App Name already exists. Please use a different name'));
                return;
            }

            let defaultAppDefinition = {
                hasPersistentData: !!hasPersistentData,
                instanceCount: 1,
                networks: [CaptainConstants.captainNetworkName],
                envVars: [],
                volumes: [],
                ports: [],
                appPushWebhook: {}, // tokenVersion, repoInfo, pushWebhookToken
                versions: []
            };

            self.data.set(APP_DEFINITIONS + '.' + appName, defaultAppDefinition);
            resolve();

        });
    }

    deleteAppDefinition(appName) {
        const self = this;

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
    }

}

module.exports = DataStore;
