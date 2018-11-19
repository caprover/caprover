var ejs = require('ejs');
var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var fs = require('fs-extra');
var uuid = require('uuid/v4');
var request = require('request');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var defaultPageTemplate = fs.readFileSync(__dirname + '/../template/default-page.ejs').toString();
var LoadBalancerManager = /** @class */ (function () {
    function LoadBalancerManager(dockerApi, certbotManager, dataStore) {
        this.dockerApi = dockerApi;
        this.certbotManager = certbotManager;
        this.reloadInProcess = false;
        this.requestedReloadPromises = [];
        this.captainPublicRandomKey = uuid();
        this.dataStore = dataStore;
    }
    /**
     * Reloads the configuation for NGINX.
     * NOTE that this can return synchronously with UNDEFINED if there is already a process in the background.
     * @param dataStoreToQueue
     * @returns {Promise.<>}
     */
    LoadBalancerManager.prototype.rePopulateNginxConfigFile = function (dataStoreToQueue) {
        var self = this;
        return new Promise(function (res, rej) {
            self.requestedReloadPromises.push({
                dataStore: dataStoreToQueue,
                resolve: res,
                reject: rej
            });
            self.consumeQueueIfAnyInNginxReloadQueue();
        });
    };
    LoadBalancerManager.prototype.consumeQueueIfAnyInNginxReloadQueue = function () {
        var self = this;
        var q = self.requestedReloadPromises.pop();
        if (!q) {
            return;
        }
        if (self.reloadInProcess) {
            Logger.d('NGINX Reload already in process, Bouncing off...');
            return;
        }
        Logger.d('Locking NGINX configuration reloading...');
        self.reloadInProcess = true;
        var dataStore = q.dataStore;
        // This will resolve to something like: /captain/nginx/conf.d/captain
        var configFilePathBase = CaptainConstants.perAppNginxConfigPathBase + '/' + dataStore.getNameSpace();
        var FUTURE = configFilePathBase + '.fut';
        var BACKUP = configFilePathBase + '.bak';
        var CONFIG = configFilePathBase + '.conf';
        var nginxConfigContent = '';
        return fs.remove(FUTURE)
            .then(function () {
            return dataStore.getServerList();
        })
            .then(function (servers) {
            if (!servers || !servers.length) {
                return '';
            }
            var promises = [];
            var _loop_1 = function (i) {
                var s = servers[i];
                if (s.hasSsl) {
                    s.crtPath = self.getSslCertPath(s.publicDomain);
                    s.keyPath = self.getSslKeyPath(s.publicDomain);
                }
                s.staticWebRoot = CaptainConstants.nginxStaticRootDir
                    + CaptainConstants.nginxDomainSpecificHtmlDir + '/'
                    + s.publicDomain;
                promises.push(Promise.resolve()
                    .then(function () {
                    return ejs.render(s.nginxConfigTemplate, { s: s });
                })
                    .then(function (rendered) {
                    nginxConfigContent += rendered;
                }));
            };
            for (var i = 0; i < servers.length; i++) {
                _loop_1(i);
            }
            return Promise.all(promises);
        })
            .then(function () {
            return fs.outputFile(FUTURE, nginxConfigContent);
        })
            .then(function () {
            return fs.remove(BACKUP);
        })
            .then(function () {
            return fs.ensureFile(CONFIG);
        })
            .then(function () {
            return fs.renameSync(CONFIG, BACKUP); // sync method. It's really fast.
        })
            .then(function () {
            return fs.renameSync(FUTURE, CONFIG); // sync method. It's really fast.
        })
            .then(function () {
            return self.createRootConfFile(dataStore);
        })
            .then(function () {
            Logger.d('SUCCESS: UNLocking NGINX configuration reloading...');
            self.reloadInProcess = false;
            q.resolve();
            self.consumeQueueIfAnyInNginxReloadQueue();
        })
            .catch(function (error) {
            Logger.e(error);
            Logger.d('Error: UNLocking NGINX configuration reloading...');
            self.reloadInProcess = false;
            q.reject(error);
            self.consumeQueueIfAnyInNginxReloadQueue();
        });
    };
    LoadBalancerManager.prototype.sendReloadSignal = function () {
        return this.dockerApi.sendSingleContainerKillHUP(CaptainConstants.nginxServiceName);
    };
    LoadBalancerManager.prototype.getCaptainPublicRandomKey = function () {
        return this.captainPublicRandomKey;
    };
    LoadBalancerManager.prototype.getSslCertPath = function (domainName) {
        var self = this;
        return CaptainConstants.letsEncryptEtcPathOnNginx + self.certbotManager.getCertRelativePathForDomain(domainName);
    };
    LoadBalancerManager.prototype.getSslKeyPath = function (domainName) {
        var self = this;
        return CaptainConstants.letsEncryptEtcPathOnNginx + self.certbotManager.getKeyRelativePathForDomain(domainName);
    };
    LoadBalancerManager.prototype.getInfo = function () {
        return new Promise(function (resolve, reject) {
            var url = 'http://' + CaptainConstants.nginxServiceName + '/nginx_status';
            request(url, function (error, response, body) {
                if (error || !body) {
                    Logger.e("Error        " + error);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Request to nginx Failed.'));
                    return;
                }
                try {
                    var data = {};
                    var lines = body.split('\n');
                    data.activeConnections = Number(lines[0].split(' ')[2].trim());
                    data.accepted = Number(lines[2].split(' ')[1].trim());
                    data.handled = Number(lines[2].split(' ')[2].trim());
                    data.total = Number(lines[2].split(' ')[3].trim());
                    data.reading = Number(lines[3].split(' ')[1].trim());
                    data.writing = Number(lines[3].split(' ')[3].trim());
                    data.waiting = Number(lines[3].split(' ')[5].trim());
                    resolve(data);
                }
                catch (error) {
                    Logger.e('Cannot parse ' + body);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Parser Failed. See internal logs...'));
                }
            });
        });
    };
    LoadBalancerManager.prototype.createRootConfFile = function (dataStore) {
        var self = this;
        var captainDomain = CaptainConstants.captainSubDomain + '.' + dataStore.getRootDomain();
        var registryDomain = CaptainConstants.registrySubDomain + '.' + dataStore.getRootDomain();
        var hasRootSsl = false;
        var FUTURE = CaptainConstants.rootNginxConfigPath + '.fut';
        var BACKUP = CaptainConstants.rootNginxConfigPath + '.bak';
        var CONFIG = CaptainConstants.rootNginxConfigPath + '.conf';
        var rootNginxTemplate = null;
        return Promise.resolve()
            .then(function () {
            return dataStore.getNginxConfig();
        })
            .then(function (nginxConfig) {
            rootNginxTemplate = nginxConfig.captainConfig.customValue || nginxConfig.captainConfig.byDefault;
            return dataStore.getHasRootSsl();
        })
            .then(function (hasSsl) {
            hasRootSsl = hasSsl;
            return dataStore.getHasRegistrySsl();
        })
            .then(function (hasRegistrySsl) {
            return ejs.render(rootNginxTemplate, {
                captain: {
                    crtPath: self.getSslCertPath(captainDomain),
                    keyPath: self.getSslKeyPath(captainDomain),
                    hasRootSsl: hasRootSsl,
                    serviceName: CaptainConstants.captainServiceName,
                    domain: captainDomain,
                    serviceExposedPort: CaptainConstants.captainServiceExposedPort,
                    defaultHtmlDir: CaptainConstants.nginxStaticRootDir + CaptainConstants.nginxDefaultHtmlDir,
                    staticWebRoot: CaptainConstants.nginxStaticRootDir
                        + CaptainConstants.nginxDomainSpecificHtmlDir + '/'
                        + captainDomain
                },
                registry: {
                    crtPath: self.getSslCertPath(registryDomain),
                    keyPath: self.getSslKeyPath(registryDomain),
                    hasRootSsl: hasRegistrySsl,
                    domain: registryDomain,
                    staticWebRoot: CaptainConstants.nginxStaticRootDir
                        + CaptainConstants.nginxDomainSpecificHtmlDir + '/'
                        + registryDomain
                }
            });
        })
            .then(function (rootNginxConfContent) {
            return fs.outputFile(FUTURE, rootNginxConfContent);
        })
            .then(function () {
            return fs.remove(BACKUP);
        })
            .then(function () {
            return fs.ensureFile(CONFIG);
        })
            .then(function () {
            return fs.renameSync(CONFIG, BACKUP); // sync method. It's really fast.
        })
            .then(function () {
            return fs.renameSync(FUTURE, CONFIG); // sync method. It's really fast.
        });
    };
    LoadBalancerManager.prototype.ensureBaseNginxConf = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getNginxConfig();
        })
            .then(function (captainConfig) {
            var baseConfigTemplate = captainConfig.baseConfig.customValue || captainConfig.baseConfig.byDefault;
            return ejs.render(baseConfigTemplate, {});
        })
            .then(function (baseNginxConfFileContent) {
            return fs.outputFile(CaptainConstants.baseNginxConfigPath, baseNginxConfFileContent);
        });
    };
    LoadBalancerManager.prototype.init = function (myNodeId, dataStore) {
        var dockerApi = this.dockerApi;
        var self = this;
        function createNginxServiceOnNode(nodeId) {
            Logger.d('No Captain Nginx service is running. Creating one on captain node...');
            return dockerApi.createServiceOnNodeId(CaptainConstants.nginxImageName, CaptainConstants.nginxServiceName, [{
                    protocol: 'tcp',
                    publishMode: 'host',
                    containerPort: 80,
                    hostPort: CaptainConstants.nginxPortNumber
                }, {
                    protocol: 'tcp',
                    publishMode: 'host',
                    containerPort: 443,
                    hostPort: 443
                }], nodeId, null, null, {
                Reservation: {
                    MemoryBytes: 30 * 1024 * 1024
                }
            })
                .then(function () {
                var waitTimeInMillis = 5000;
                Logger.d('Waiting for ' + (waitTimeInMillis / 1000) + ' seconds for nginx to start up');
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        resolve(true);
                    }, waitTimeInMillis);
                });
            });
        }
        return fs
            .outputFile(CaptainConstants.captainStaticFilesDir
            + CaptainConstants.nginxDefaultHtmlDir
            + CaptainConstants.captainConfirmationPath, self.getCaptainPublicRandomKey())
            .then(function () {
            return ejs.render(defaultPageTemplate, { message: 'Nothing here yet :/' });
        })
            .then(function (staticPageContent) {
            return fs.outputFile(CaptainConstants.captainStaticFilesDir +
                CaptainConstants.nginxDefaultHtmlDir
                + '/index.html', staticPageContent);
        })
            .then(function () {
            return ejs.render(defaultPageTemplate, { message: 'An Error Occurred :/' });
        })
            .then(function (errorPageContent) {
            return fs.outputFile(CaptainConstants.captainStaticFilesDir +
                CaptainConstants.nginxDefaultHtmlDir
                + '/error.html', errorPageContent);
        })
            .then(function () {
            Logger.d('Setting up NGINX conf file...');
            return self.ensureBaseNginxConf();
        })
            .then(function () {
            return self.rePopulateNginxConfigFile(dataStore);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.letsEncryptEtcPath);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.nginxSharedPathOnHost);
        })
            .then(function () {
            return dockerApi
                .isServiceRunningByName(CaptainConstants.nginxServiceName);
        })
            .then(function (isRunning) {
            if (isRunning) {
                Logger.d('Captain Nginx is already running.. ');
                return dockerApi
                    .getNodeIdByServiceName(CaptainConstants.nginxServiceName);
            }
            else {
                return createNginxServiceOnNode(myNodeId)
                    .then(function () {
                    return myNodeId;
                });
            }
        })
            .then(function (nodeId) {
            if (nodeId !== myNodeId) {
                Logger.d('Captain Nginx is running on a different node. Removing...');
                return dockerApi
                    .removeServiceByName(CaptainConstants.nginxServiceName)
                    .then(function () {
                    return createNginxServiceOnNode(myNodeId)
                        .then(function () {
                        return true;
                    });
                });
            }
            else {
                return true;
            }
        })
            .then(function () {
            Logger.d('Updating NGINX service...');
            return dockerApi.updateService(CaptainConstants.nginxServiceName, null, [
                {
                    containerPath: CaptainConstants.nginxStaticRootDir,
                    hostPath: CaptainConstants.captainStaticFilesDir
                },
                {
                    containerPath: '/etc/nginx/nginx.conf',
                    hostPath: CaptainConstants.baseNginxConfigPath
                },
                {
                    containerPath: '/etc/nginx/conf.d',
                    hostPath: CaptainConstants.perAppNginxConfigPathBase
                },
                {
                    containerPath: CaptainConstants.letsEncryptEtcPathOnNginx,
                    hostPath: CaptainConstants.letsEncryptEtcPath
                },
                {
                    containerPath: CaptainConstants.nginxSharedPathOnNginx,
                    hostPath: CaptainConstants.nginxSharedPathOnHost
                }
            ], [CaptainConstants.captainNetworkName]);
        })
            .then(function () {
            var waitTimeInMillis = 5000;
            Logger.d('Waiting for ' + (waitTimeInMillis / 1000) + ' seconds for nginx reload to take into effect');
            return new Promise(function (resolve, reject) {
                setTimeout(function () {
                    Logger.d('NGINX is fully set up and working...');
                    resolve(true);
                }, waitTimeInMillis);
            });
        });
    };
    return LoadBalancerManager;
}());
module.exports = LoadBalancerManager;
