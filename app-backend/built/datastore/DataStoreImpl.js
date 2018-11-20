"use strict";
/**
 * Created by kasra on 27/06/17.
 */
const Configstore = require("configstore");
const uuid = require("uuid/v4");
const fs = require("fs-extra");
const ApiStatusCodes = require("../api/ApiStatusCodes");
const CaptainConstants = require("../utils/CaptainConstants");
const AppsDataStore = require("./AppsDataStore");
const NAMESPACE = "namespace";
const HASHED_PASSWORD = "hashedPassword";
const CAPTAIN_REGISTRY_AUTH_SECRET_VER = "captainRegistryAuthSecretVer";
const CUSTOM_DOMAIN = "customDomain";
const HAS_ROOT_SSL = "hasRootSsl";
const FORCE_ROOT_SSL = "forceRootSsl";
const HAS_REGISTRY_SSL = "hasRegistrySsl";
const HAS_LOCAL_REGISTRY = "hasLocalRegistry";
const EMAIL_ADDRESS = "emailAddress";
const DOCKER_REGISTRIES = "dockerRegistries";
const DEFAULT_DOCKER_REGISTRY = "defaultDockerReg";
const NET_DATA_INFO = "netDataInfo";
const NGINX_BASE_CONFIG = "NGINX_BASE_CONFIG";
const NGINX_CAPTAIN_CONFIG = "NGINX_CAPTAIN_CONFIG";
const DEFAULT_CAPTAIN_ROOT_DOMAIN = "captain.localhost";
const DEFAULT_NGINX_BASE_CONFIG = fs.readFileSync(__dirname + "/../../template/base-nginx-conf.ejs").toString();
const DEFAULT_NGINX_CAPTAIN_CONFIG = fs.readFileSync(__dirname + "/../../template/root-nginx-conf.ejs").toString();
const DEFAULT_NGINX_CONFIG_FOR_APP = fs.readFileSync(__dirname + "/../../template/server-block-conf.ejs").toString();
class DataStore {
    constructor(namespace) {
        const data = new Configstore("captain-store", {});
        data.path = CaptainConstants.captainRootDirectory + "/config.conf";
        this.data = data;
        this.data.set(NAMESPACE, namespace);
        this.appsDataStore = new AppsDataStore(this.data);
    }
    getNameSpace() {
        return this.data.get(NAMESPACE);
    }
    setHashedPassword(newHashedPassword) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(HASHED_PASSWORD, newHashedPassword);
        });
    }
    getHashedPassword() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(HASHED_PASSWORD);
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
            const netDataInfo = self.data.get(NET_DATA_INFO) || {};
            netDataInfo.isEnabled = netDataInfo.isEnabled || false;
            netDataInfo.data = netDataInfo.data || {};
            return netDataInfo;
        });
    }
    setNetDataInfo(netDataInfo) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(NET_DATA_INFO, netDataInfo);
        });
    }
    setRegistryAuthSecretVersion(ver) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(CAPTAIN_REGISTRY_AUTH_SECRET_VER, Number(ver));
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
        return "srv-" + this.getNameSpace() + "--" + appName;
    }
    getImageName(authObj, appName, version) {
        let authPrefix = "";
        if (authObj) {
            authPrefix = authObj.serveraddress + "/" + authObj.username + "/";
        }
        return authPrefix + this.getImageNameWithoutAuthObj(appName, version);
    }
    getImageNameWithoutAuthObj(appName, versionStr) {
        if (versionStr === 0) {
            versionStr = "0";
        }
        return this.getImageNameBase() + appName + (versionStr ? (":" + versionStr) : "");
    }
    getImageNameBase() {
        return "img-" + this.getNameSpace() + "--";
    }
    getRootDomain() {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN;
    }
    hasCustomDomain() {
        return !!this.data.get(CUSTOM_DOMAIN);
    }
    getServerList() {
        const self = this;
        let hasRootSsl;
        let rootDomain;
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
            return self.getDefaultAppNginxConfig();
        })
            .then(function (defaultAppNginxConfig) {
            return self.getAppsDataStore().getAppsServerConfig(defaultAppNginxConfig, hasRootSsl, rootDomain);
        });
    }
    getAppsDataStore() {
        return this.appsDataStore;
    }
    getDefaultPushRegistry() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(DEFAULT_DOCKER_REGISTRY);
        });
    }
    setDefaultPushRegistry(registryId) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            let found = false;
            const registries = self.data.get(DOCKER_REGISTRIES) || [];
            for (let i = 0; i < registries.length; i++) {
                const registry = registries[i];
                if (registry.id === registryId) {
                    found = true;
                }
            }
            // registryId can be NULL/Empty, meaning that no registry will be the default push registry
            if (!found && !!registryId) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, "Registry not found");
            }
            self.data.set(DEFAULT_DOCKER_REGISTRY, registryId);
        });
    }
    deleteRegistry(registryId) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            const newReg = [];
            const registries = self.data.get(DOCKER_REGISTRIES) || [];
            for (let i = 0; i < registries.length; i++) {
                const registry = registries[i];
                if (registry.id !== registryId) {
                    newReg.push(registry);
                }
            }
            if (newReg.length === registries.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, "Registry not found");
            }
            self.data.set(DOCKER_REGISTRIES, newReg);
        });
    }
    getAllRegistries() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(DOCKER_REGISTRIES);
        });
    }
    addRegistryToDb(registryUser, registryPasswordEncrypted, registryDomain, registryImagePrefix) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return new Promise(function (resolve, reject) {
                resolve(self.data.get(DOCKER_REGISTRIES) || []);
            });
        })
            .then(function (registries) {
            let id = uuid();
            let isAlreadyTaken = true;
            while (isAlreadyTaken) {
                id = uuid();
                isAlreadyTaken = false;
                for (let i = 0; i < registries.length; i++) {
                    if (registries[i].id === id) {
                        isAlreadyTaken = true;
                        break;
                    }
                }
            }
            registries.push({
                id,
                registryUser,
                registryPasswordEncrypted,
                registryDomain,
                registryImagePrefix
            });
            self.data.set(DOCKER_REGISTRIES, registries);
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
    getDefaultAppNginxConfig() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return DEFAULT_NGINX_CONFIG_FOR_APP;
        });
    }
    getNginxConfig() {
        const self = this;
        return Promise.resolve()
            .then(function () {
            return ({
                baseConfig: {
                    byDefault: DEFAULT_NGINX_BASE_CONFIG,
                    customValue: self.data.get(NGINX_BASE_CONFIG)
                },
                captainConfig: {
                    byDefault: DEFAULT_NGINX_CAPTAIN_CONFIG,
                    customValue: self.data.get(NGINX_CAPTAIN_CONFIG)
                }
            });
        });
    }
    setNginxConfig(baseConfig, captainConfig) {
        const self = this;
        return Promise.resolve()
            .then(function () {
            self.data.set(NGINX_BASE_CONFIG, baseConfig);
            self.data.set(NGINX_CAPTAIN_CONFIG, captainConfig);
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
}
module.exports = DataStore;
//# sourceMappingURL=DataStoreImpl.js.map