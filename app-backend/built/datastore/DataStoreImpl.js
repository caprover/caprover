/**
 * Created by kasra on 27/06/17.
 */
var Configstore = require('configstore');
var uuid = require('uuid/v4');
var isValidPath = require('is-valid-path');
var fs = require('fs-extra');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var Encryptor = require('../utils/Encryptor');
var AppsDataStore = require('./AppsDataStore');
var NAMESPACE = 'namespace';
var HASHED_PASSWORD = 'hashedPassword';
var CAPTAIN_REGISTRY_AUTH_SECRET_VER = 'captainRegistryAuthSecretVer';
var CUSTOM_DOMAIN = 'customDomain';
var HAS_ROOT_SSL = 'hasRootSsl';
var FORCE_ROOT_SSL = 'forceRootSsl';
var HAS_REGISTRY_SSL = 'hasRegistrySsl';
var HAS_LOCAL_REGISTRY = 'hasLocalRegistry';
var EMAIL_ADDRESS = 'emailAddress';
var DOCKER_REGISTRIES = 'dockerRegistries';
var DEFAULT_DOCKER_REGISTRY = 'defaultDockerReg';
var NET_DATA_INFO = 'netDataInfo';
var NGINX_BASE_CONFIG = 'NGINX_BASE_CONFIG';
var NGINX_CAPTAIN_CONFIG = 'NGINX_CAPTAIN_CONFIG';
var DEFAULT_CAPTAIN_ROOT_DOMAIN = 'captain.localhost';
var DEFAULT_NGINX_BASE_CONFIG = fs.readFileSync(__dirname + '/../template/base-nginx-conf.ejs').toString();
var DEFAULT_NGINX_CAPTAIN_CONFIG = fs.readFileSync(__dirname + '/../template/root-nginx-conf.ejs').toString();
var DEFAULT_NGINX_CONFIG_FOR_APP = fs.readFileSync(__dirname + '/../template/server-block-conf.ejs').toString();
var DataStore = /** @class */ (function () {
    function DataStore(namespace) {
        var data = new Configstore('captain-store', {});
        data.path = CaptainConstants.captainRootDirectory + '/config.conf';
        this.data = data;
        this.data.set(NAMESPACE, namespace);
        this.appsDataStore = new AppsDataStore(this.data);
    }
    DataStore.prototype.getNameSpace = function () {
        return this.data.get(NAMESPACE);
    };
    DataStore.prototype.setHashedPassword = function (newHashedPassword) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(HASHED_PASSWORD, newHashedPassword);
        });
    };
    DataStore.prototype.getHashedPassword = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(HASHED_PASSWORD);
        });
    };
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
    DataStore.prototype.getNetDataInfo = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            var netDataInfo = self.data.get(NET_DATA_INFO) || {};
            netDataInfo.isEnabled = netDataInfo.isEnabled || false;
            netDataInfo.data = netDataInfo.data || {};
            return netDataInfo;
        });
    };
    DataStore.prototype.setNetDataInfo = function (netDataInfo) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(NET_DATA_INFO, netDataInfo);
        });
    };
    DataStore.prototype.setRegistryAuthSecretVersion = function (ver) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.set(CAPTAIN_REGISTRY_AUTH_SECRET_VER, Number(ver));
        });
    };
    DataStore.prototype.getRegistryAuthSecretVersion = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return (self.data.get(CAPTAIN_REGISTRY_AUTH_SECRET_VER) || 0);
        });
    };
    DataStore.prototype.getServiceName = function (appName) {
        return 'srv-' + this.getNameSpace() + '--' + appName;
    };
    DataStore.prototype.getImageName = function (authObj, appName, version) {
        var authPrefix = '';
        if (authObj) {
            authPrefix = authObj.serveraddress + '/' + authObj.username + '/';
        }
        return authPrefix + this.getImageNameWithoutAuthObj(appName, version);
    };
    DataStore.prototype.getImageNameWithoutAuthObj = function (appName, version) {
        if (version === 0) {
            version = '0';
        }
        return this.getImageNameBase() + appName + (version ? (':' + version) : '');
    };
    DataStore.prototype.getImageNameBase = function () {
        return 'img-' + this.getNameSpace() + '--';
    };
    DataStore.prototype.getRootDomain = function () {
        return this.data.get(CUSTOM_DOMAIN) || DEFAULT_CAPTAIN_ROOT_DOMAIN;
    };
    DataStore.prototype.hasCustomDomain = function () {
        return !!this.data.get(CUSTOM_DOMAIN);
    };
    DataStore.prototype.getServerList = function () {
        var self = this;
        var hasRootSsl = null;
        var rootDomain = null;
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
    };
    DataStore.prototype.getAppsDataStore = function () {
        return this.appsDataStore;
    };
    DataStore.prototype.getDefaultPushRegistry = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(DEFAULT_DOCKER_REGISTRY);
        });
    };
    DataStore.prototype.setDefaultPushRegistry = function (registryId) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            var found = false;
            var registries = self.data.get(DOCKER_REGISTRIES) || [];
            for (var i = 0; i < registries.length; i++) {
                var registry = registries[i];
                if (registry.id === registryId) {
                    found = true;
                }
            }
            // registryId can be NULL/Empty, meaning that no registry will be the default push registry
            if (!found && !!registryId) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, 'Registry not found');
            }
            self.data.set(DEFAULT_DOCKER_REGISTRY, registryId);
        });
    };
    DataStore.prototype.deleteRegistry = function (registryId) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            var newReg = [];
            var registries = self.data.get(DOCKER_REGISTRIES) || [];
            for (var i = 0; i < registries.length; i++) {
                var registry = registries[i];
                if (registry.id !== registryId) {
                    newReg.push(registry);
                }
            }
            if (newReg.length === registries.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.NOT_FOUND, 'Registry not found');
            }
            self.data.set(DOCKER_REGISTRIES, newReg);
        });
    };
    DataStore.prototype.getAllRegistries = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.data.get(DOCKER_REGISTRIES);
        });
    };
    DataStore.prototype.addRegistryToDb = function (registryUser, registryPasswordEncrypted, registryDomain, registryImagePrefix) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return new Promise(function (resolve, reject) {
                resolve(self.data.get(DOCKER_REGISTRIES) || []);
            });
        })
            .then(function (registries) {
            var id = null;
            var isAlreadyTaken = true;
            while (isAlreadyTaken) {
                id = uuid();
                isAlreadyTaken = false;
                for (var i = 0; i < registries.length; i++) {
                    if (registries[i].id === id) {
                        isAlreadyTaken = true;
                        break;
                    }
                }
            }
            registries.push({
                id: id, registryUser: registryUser, registryPasswordEncrypted: registryPasswordEncrypted, registryDomain: registryDomain, registryImagePrefix: registryImagePrefix
            });
            self.data.set(DOCKER_REGISTRIES, registries);
        });
    };
    DataStore.prototype.setUserEmailAddress = function (emailAddress) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(EMAIL_ADDRESS, emailAddress);
            resolve();
        });
    };
    DataStore.prototype.getUserEmailAddress = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(EMAIL_ADDRESS));
        });
    };
    DataStore.prototype.setHasRootSsl = function (hasRootSsl) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(HAS_ROOT_SSL, hasRootSsl);
            resolve();
        });
    };
    DataStore.prototype.setForceSsl = function (forceSsl) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(FORCE_ROOT_SSL, forceSsl);
            resolve();
        });
    };
    DataStore.prototype.getForceSsl = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(FORCE_ROOT_SSL));
        });
    };
    DataStore.prototype.setHasRegistrySsl = function (hasRegistrySsl) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(HAS_REGISTRY_SSL, hasRegistrySsl);
            resolve();
        });
    };
    DataStore.prototype.getDefaultAppNginxConfig = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return DEFAULT_NGINX_CONFIG_FOR_APP;
        });
    };
    DataStore.prototype.getNginxConfig = function () {
        var self = this;
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
    };
    DataStore.prototype.setNginxConfig = function (baseConfig, captainConfig) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            self.data.set(NGINX_BASE_CONFIG, baseConfig);
            self.data.set(NGINX_CAPTAIN_CONFIG, captainConfig);
        });
    };
    DataStore.prototype.getHasRootSsl = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(HAS_ROOT_SSL));
        });
    };
    DataStore.prototype.setHasLocalRegistry = function (hasLocalRegistry) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(HAS_LOCAL_REGISTRY, hasLocalRegistry);
            resolve();
        });
    };
    DataStore.prototype.getHasLocalRegistry = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(HAS_LOCAL_REGISTRY));
        });
    };
    DataStore.prototype.getHasRegistrySsl = function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            resolve(self.data.get(HAS_REGISTRY_SSL));
        });
    };
    DataStore.prototype.setCustomDomain = function (customDomain) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self.data.set(CUSTOM_DOMAIN, customDomain);
            resolve();
        });
    };
    return DataStore;
}());
module.exports = DataStore;
