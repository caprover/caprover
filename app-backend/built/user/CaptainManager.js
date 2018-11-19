var uuid = require('uuid/v4');
var DockerApi = require('../docker/DockerApi');
var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var fs = require('fs-extra');
var LoadBalancerManager = require('./LoadBalancerManager');
var EnvVars = require('../utils/EnvVars');
var Encryptor = require('../utils/Encryptor');
var CertbotManager = require('./CertbotManager');
var DockerRegistry = require('./DockerRegistry');
var request = require('request');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var SshClient = require('ssh2').Client;
var DataStoreProvider = require('../datastore/DataStoreProvider');
var DEBUG_SALT = 'THIS IS NOT A REAL CERTIFICATE';
var MAX_FAIL_ALLOWED = 4;
var HEALTH_CHECK_INTERVAL = 20000; //ms
var TIMEOUT_HEALTH_CHECK = 15000; //ms
var CaptainManager = /** @class */ (function () {
    function CaptainManager() {
        var dockerApi = DockerApi.get();
        this.hasForceSsl = false;
        this.dataStore = DataStoreProvider.getDataStore(CaptainConstants.rootNameSpace);
        this.dockerApi = dockerApi;
        this.certbotManager = new CertbotManager(dockerApi);
        this.loadBalancerManager = new LoadBalancerManager(dockerApi, this.certbotManager, this.dataStore);
        this.dockerRegistry = new DockerRegistry(dockerApi, this.dataStore, this.certbotManager, this.loadBalancerManager, this);
        this.myNodeId = null;
        this.initRetryCount = 0;
        this.inited = false;
        this.waitUntilRestarted = false;
        this.captainSalt = '';
        this.dockerAuthObj = '';
        this.consecutiveHealthCheckFailCount = 0;
        this.healthCheckUuid = uuid();
    }
    CaptainManager.prototype.initialize = function () {
        // If a linked file / directory is deleted on the host, it loses the connection to
        // the container and needs an update to be picked up again.
        var self = this;
        var dataStore = this.dataStore;
        var dockerApi = this.dockerApi;
        var loadBalancerManager = this.loadBalancerManager;
        var certbotManager = this.certbotManager;
        var myNodeId = null;
        self.refreshForceSslState()
            .then(function () {
            return dockerApi.getNodeIdByServiceName(CaptainConstants.captainServiceName);
        })
            .then(function (nodeId) {
            myNodeId = nodeId;
            self.myNodeId = myNodeId;
            return dockerApi.isNodeManager(myNodeId);
        })
            .then(function (isManager) {
            if (!isManager) {
                throw new Error('Captain should only run on a manager node');
            }
        })
            .then(function () {
            Logger.d('Emptying generated and temp folders.');
            return fs.emptyDir(CaptainConstants.captainRootDirectoryTemp);
        })
            .then(function () {
            return fs.emptyDir(CaptainConstants.captainRootDirectoryGenerated);
        })
            .then(function () {
            Logger.d('Ensuring directories are available on host. Started.');
            return fs.ensureDir(CaptainConstants.letsEncryptEtcPath);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.letsEncryptLibPath);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.captainStaticFilesDir);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.perAppNginxConfigPathBase);
        })
            .then(function () {
            return fs.ensureFile(CaptainConstants.baseNginxConfigPath);
        })
            .then(function () {
            return fs.ensureDir(CaptainConstants.registryPathOnHost);
        })
            .then(function () {
            return dockerApi.ensureOverlayNetwork(CaptainConstants.captainNetworkName);
        })
            .then(function () {
            Logger.d('Ensuring directories are available on host. Finished.');
            return dockerApi.ensureServiceConnectedToNetwork(CaptainConstants.captainServiceName, CaptainConstants.captainNetworkName);
        })
            .then(function () {
            return loadBalancerManager.init(myNodeId, dataStore);
        })
            .then(function () {
            var valueIfNotExist = CaptainConstants.isDebug ? DEBUG_SALT : uuid();
            return dockerApi.ensureSecret(CaptainConstants.captainSaltSecretKey, valueIfNotExist);
        })
            .then(function () {
            return dockerApi.ensureSecretOnService(CaptainConstants.captainServiceName, CaptainConstants.captainSaltSecretKey);
        })
            .then(function (secretHadExistedBefore) {
            if (!secretHadExistedBefore) {
                return new Promise(function () {
                    Logger.d('I am halting here. I expect to get restarted in a few seconds due to a secret (captain salt) being updated.');
                });
            }
            return dataStore.getRegistryAuthSecretVersion();
        })
            .then(function (currentVersion) {
            var secretName = CaptainConstants.captainRegistryAuthHeaderSecretPrefix + currentVersion;
            if (currentVersion > 0) {
                Logger.d('Updating secrets to update docker registry auth.');
                return dockerApi
                    .ensureSecretOnService(CaptainConstants.captainServiceName, secretName)
                    .then(function (secretHadExistedBefore) {
                    if (!secretHadExistedBefore) {
                        return new Promise(function () {
                            Logger.d('I am halting here. I expect to get restarted in a few seconds due to a secret (registry auth) being updated.');
                        });
                    }
                });
            }
        })
            .then(function () {
            return dataStore.getRegistryAuthSecretVersion();
        })
            .then(function (currentVersion) {
            if (currentVersion === 0) {
                Logger.d('There is no Docker Registry, neither local nor remote.');
                return true;
            }
            var secretName = CaptainConstants.captainRegistryAuthHeaderSecretPrefix + currentVersion;
            var secretFileName = '/run/secrets/' + secretName;
            if (!fs.existsSync(secretFileName)) {
                throw new Error('Secret is attached according to Docker. But file cannot be found. ' + secretFileName);
            }
            var secretContent = fs.readFileSync(secretFileName).toString();
            if (!secretContent) {
                throw new Error('Docker Auth content is empty!');
            }
            self.dockerAuthObj = JSON.parse(secretContent);
            return true;
        })
            .then(function () {
            var secretFileName = '/run/secrets/' + CaptainConstants.captainSaltSecretKey;
            if (!fs.existsSync(secretFileName)) {
                if (CaptainConstants.isDebug) {
                    Logger.d('SECURITY WARNING! Setting the salt to default! Perhaps you are running the code outside of the container?');
                    self.captainSalt = DEBUG_SALT;
                    return true;
                }
                throw new Error('Secret is attached according to Docker. But file cannot be found. ' + secretFileName);
            }
            var secretContent = fs.readFileSync(secretFileName).toString();
            if (!secretContent) {
                throw new Error('Salt secret content is empty!');
            }
            self.captainSalt = secretContent;
            return true;
        })
            .then(function () {
            return certbotManager.init(myNodeId);
        })
            .then(function () {
            return dataStore.getHasLocalRegistry();
        })
            .then(function (hasLocalRegistry) {
            if (hasLocalRegistry) {
                Logger.d('Ensuring Docker Registry is running...');
                return self.dockerRegistry.ensureDockerRegistryRunningOnThisNode();
            }
        })
            .then(function () {
            self.inited = true;
            self.performHealthCheck();
            Logger.d('**** Captain is initialized and ready to serve you! ****');
        })
            .catch(function (error) {
            Logger.e(error);
            self.initRetryCount++;
            if (self.initRetryCount > 5) {
                process.exit(0);
            }
            setTimeout(function () {
                self.initialize();
            }, 10000);
        });
    };
    CaptainManager.prototype.performHealthCheck = function () {
        var self = this;
        var captainPublicDomain = CaptainConstants.captainSubDomain + '.' + self.dataStore.getRootDomain();
        function scheduleNextHealthCheck() {
            self.healthCheckUuid = uuid();
            setTimeout(function () {
                self.performHealthCheck();
            }, HEALTH_CHECK_INTERVAL);
        }
        // For debug build, we'll turn off health check
        if (CaptainConstants.isDebug || !self.dataStore.hasCustomDomain()) {
            scheduleNextHealthCheck();
            return;
        }
        function checkCaptainHealth(callback) {
            var callbackCalled = false;
            setTimeout(function () {
                if (callbackCalled) {
                    return;
                }
                callbackCalled = true;
                callback(false);
            }, TIMEOUT_HEALTH_CHECK);
            var url = 'http://' + captainPublicDomain + CaptainConstants.healthCheckEndPoint;
            request(url, function (error, response, body) {
                if (callbackCalled) {
                    return;
                }
                callbackCalled = true;
                if (error || !body || (body !== self.getHealthCheckUuid())) {
                    callback(false);
                }
                else {
                    callback(true);
                }
            });
        }
        function checkNginxHealth(callback) {
            var callbackCalled = false;
            setTimeout(function () {
                if (callbackCalled) {
                    return;
                }
                callbackCalled = true;
                callback(false);
            }, TIMEOUT_HEALTH_CHECK);
            self.verifyCaptainOwnsDomainOrThrow(captainPublicDomain, '-healthcheck')
                .then(function () {
                if (callbackCalled) {
                    return;
                }
                callbackCalled = true;
                callback(true);
            })
                .catch(function () {
                if (callbackCalled) {
                    return;
                }
                callbackCalled = true;
                callback(false);
            });
        }
        var checksPerformed = {};
        function scheduleIfNecessary() {
            if (!checksPerformed.captainHealth || !checksPerformed.nginxHealth) {
                return;
            }
            var hasFailedCheck = false;
            if (!checksPerformed.captainHealth.value) {
                Logger.w("Captain health check failed: #" + self.consecutiveHealthCheckFailCount + ' at ' + captainPublicDomain);
                hasFailedCheck = true;
            }
            if (!checksPerformed.nginxHealth.value) {
                Logger.w("NGINX health check failed: #" + self.consecutiveHealthCheckFailCount);
                hasFailedCheck = true;
            }
            if (hasFailedCheck) {
                self.consecutiveHealthCheckFailCount = self.consecutiveHealthCheckFailCount + 1;
            }
            else {
                self.consecutiveHealthCheckFailCount = 0;
            }
            scheduleNextHealthCheck();
            if (self.consecutiveHealthCheckFailCount > MAX_FAIL_ALLOWED) {
                process.exit(1);
            }
        }
        checkCaptainHealth(function (success) {
            checksPerformed.captainHealth = { value: success };
            scheduleIfNecessary();
        });
        checkNginxHealth(function (success) {
            checksPerformed.nginxHealth = { value: success };
            scheduleIfNecessary();
        });
    };
    CaptainManager.prototype.getHealthCheckUuid = function () {
        return this.healthCheckUuid;
    };
    CaptainManager.prototype.isInitialized = function () {
        return this.inited && !this.waitUntilRestarted;
    };
    CaptainManager.prototype.getCaptainImageTags = function () {
        var url = 'https://hub.docker.com/v2/repositories/' + CaptainConstants.publishedNameOnDockerHub + '/tags';
        return new Promise(function (resolve, reject) {
            request(url, function (error, response, body) {
                if (CaptainConstants.isDebug) {
                    resolve(['v0.0.1']);
                    return;
                }
                if (error) {
                    reject(error);
                }
                else if (!body || !JSON.parse(body).results) {
                    reject(new Error('Received empty body or no result for version list on docker hub.'));
                }
                else {
                    var results = JSON.parse(body).results;
                    var tags = [];
                    for (var idx = 0; idx < results.length; idx++) {
                        tags.push(results[idx].name);
                    }
                    resolve(tags);
                }
            });
        });
    };
    CaptainManager.prototype.updateCaptain = function (versionTag) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dockerApi.updateService(CaptainConstants.captainServiceName, CaptainConstants.publishedNameOnDockerHub + ':' + versionTag);
        });
    };
    CaptainManager.prototype.getMyNodeId = function () {
        if (!this.myNodeId) {
            var msg = 'myNodeId is not set yet!!';
            Logger.e(msg);
            throw new Error(msg);
        }
        return this.myNodeId;
    };
    CaptainManager.prototype.getCaptainSalt = function () {
        if (!this.captainSalt) {
            var msg = 'Captain Salt is not set yet!!';
            Logger.e(msg);
            throw new Error(msg);
        }
        return this.captainSalt;
    };
    CaptainManager.prototype.getDockerAuthObject = function () {
        return this.dockerAuthObj;
    };
    CaptainManager.prototype.updateNetDataInfo = function (netDataInfo) {
        var self = this;
        var dockerApi = this.dockerApi;
        return Promise.resolve()
            .then(function () {
            return dockerApi.ensureContainerStoppedAndRemoved(CaptainConstants.netDataContainerName, CaptainConstants.captainNetworkName);
        })
            .then(function () {
            if (netDataInfo.isEnabled) {
                var vols = [
                    {
                        hostPath: '/proc',
                        containerPath: '/host/proc',
                        mode: 'ro'
                    },
                    {
                        hostPath: '/sys',
                        containerPath: '/host/sys',
                        mode: 'ro'
                    },
                    {
                        hostPath: '/var/run/docker.sock',
                        containerPath: '/var/run/docker.sock'
                    }
                ];
                var envVars = [];
                if (netDataInfo.data.smtp) {
                    envVars.push({
                        key: 'SSMTP_TO',
                        value: netDataInfo.data.smtp.to
                    });
                    envVars.push({
                        key: 'SSMTP_HOSTNAME',
                        value: netDataInfo.data.smtp.hostname
                    });
                    envVars.push({
                        key: 'SSMTP_SERVER',
                        value: netDataInfo.data.smtp.server
                    });
                    envVars.push({
                        key: 'SSMTP_PORT',
                        value: netDataInfo.data.smtp.port
                    });
                    envVars.push({
                        key: 'SSMTP_TLS',
                        value: netDataInfo.data.smtp.allowNonTls ? 'NO' : 'YES'
                    });
                    envVars.push({
                        key: 'SSMTP_USER',
                        value: netDataInfo.data.smtp.username
                    });
                    envVars.push({
                        key: 'SSMTP_PASS',
                        value: netDataInfo.data.smtp.password
                    });
                }
                if (netDataInfo.data.slack) {
                    envVars.push({
                        key: 'SLACK_WEBHOOK_URL',
                        value: netDataInfo.data.slack.hook
                    });
                    envVars.push({
                        key: 'SLACK_CHANNEL',
                        value: netDataInfo.data.slack.channel
                    });
                }
                if (netDataInfo.data.telegram) {
                    envVars.push({
                        key: 'TELEGRAM_BOT_TOKEN',
                        value: netDataInfo.data.telegram.botToken
                    });
                    envVars.push({
                        key: 'TELEGRAM_CHAT_ID',
                        value: netDataInfo.data.telegram.chatId
                    });
                }
                if (netDataInfo.data.pushBullet) {
                    envVars.push({
                        key: 'PUSHBULLET_ACCESS_TOKEN',
                        value: netDataInfo.data.pushBullet.apiToken
                    });
                    envVars.push({
                        key: 'PUSHBULLET_DEFAULT_EMAIL',
                        value: netDataInfo.data.pushBullet.fallbackEmail
                    });
                }
                return dockerApi.createStickyContainer(CaptainConstants.netDataContainerName, CaptainConstants.netDataImageName, vols, CaptainConstants.captainNetworkName, envVars, ['SYS_PTRACE']);
            }
            // Just removing the old container. No need to create a new one.
            return true;
        })
            .then(function () {
            return self.dataStore.setNetDataInfo(netDataInfo);
        });
    };
    CaptainManager.prototype.getNodesInfo = function () {
        var dockerApi = this.dockerApi;
        return Promise.resolve()
            .then(function () {
            return dockerApi.getNodesInfo();
        })
            .then(function (data) {
            if (!data || !data.length) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'No cluster node was found!');
            }
            return data;
        });
    };
    CaptainManager.prototype.joinDockerNode = function (captainIpAddress, isManager, remoteNodeIpAddress, remoteUserName, privateKey) {
        var dockerApi = this.dockerApi;
        return Promise.resolve()
            .then(function () {
            return dockerApi.getJoinToken(isManager);
        })
            .then(function (token) {
            return new Promise(function (resolve, reject) {
                var conn = new SshClient();
                conn
                    .on('error', function (err) {
                    Logger.e(err);
                    reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'SSH Connection error!!'));
                })
                    .on('ready', function () {
                    Logger.d('SSH Client :: ready');
                    conn.exec(dockerApi.createJoinCommand(captainIpAddress, token), function (err, stream) {
                        if (err) {
                            Logger.e(err);
                            reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'SSH Running command failed!!'));
                            return;
                        }
                        var hasExisted = false;
                        stream
                            .on('close', function (code, signal) {
                            Logger.d('Stream :: close :: code: ' + code + ', signal: ' + signal);
                            conn.end();
                            if (hasExisted) {
                                return;
                            }
                            hasExisted = true;
                            resolve();
                        })
                            .on('data', function (data) {
                            Logger.d('STDOUT: ' + data);
                        })
                            .stderr
                            .on('data', function (data) {
                            Logger.e('STDERR: ' + data);
                            if (hasExisted) {
                                return;
                            }
                            hasExisted = true;
                            reject(ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'Error during setup: ' + data));
                        });
                    });
                })
                    .connect({
                    host: remoteNodeIpAddress,
                    port: 22,
                    username: remoteUserName,
                    privateKey: privateKey
                });
            });
        });
    };
    CaptainManager.prototype.getLoadBalanceManager = function () {
        return this.loadBalancerManager;
    };
    CaptainManager.prototype.reloadLoadBalancer = function (ds) {
        var self = this;
        return self.loadBalancerManager.rePopulateNginxConfigFile(ds)
            .then(function () {
            Logger.d('sendReloadSignal...');
            return self.loadBalancerManager.sendReloadSignal();
        });
    };
    CaptainManager.prototype.getDockerRegistry = function () {
        return this.dockerRegistry;
    };
    CaptainManager.prototype.setDefaultPushRegistry = function (registryId) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.setDefaultPushRegistry(registryId);
        });
    };
    CaptainManager.prototype.getDefaultPushRegistry = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getDefaultPushRegistry();
        });
    };
    CaptainManager.prototype.deleteRegistry = function (registryId) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.getDefaultPushRegistry();
        })
            .then(function (registryIdDefaultPush) {
            if (registryId === registryIdDefaultPush) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_PARAMETER, 'Cannot remove the default push');
            }
            return self.dataStore.deleteRegistry(registryId);
        });
    };
    CaptainManager.prototype.getAllRegistries = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return (self.dataStore.getAllRegistries() || []);
        });
    };
    CaptainManager.prototype.addRegistry = function (registryUser, registryPassword, registryDomain, registryImagePrefix) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            if (!registryUser || !registryPassword || !registryDomain) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_PARAMETER, 'User, password and domain are required.');
            }
            var passwordEncrypted = Encryptor.create(self.getCaptainSalt()).encrypt(registryPassword);
            return self.dataStore.addRegistryToDb(registryUser, passwordEncrypted, registryDomain, registryImagePrefix);
        });
    };
    CaptainManager.prototype.enableSsl = function (emailAddress) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.certbotManager.ensureRegistered(emailAddress);
        })
            .then(function () {
            return self.certbotManager.enableSsl(CaptainConstants.captainSubDomain + '.' + self.dataStore.getRootDomain());
        })
            .then(function () {
            return self.dataStore.setUserEmailAddress(emailAddress);
        })
            .then(function () {
            return self.dataStore.setHasRootSsl(true);
        })
            .then(function () {
            return self.loadBalancerManager.rePopulateNginxConfigFile(self.dataStore);
        })
            .then(function () {
            return self.loadBalancerManager.sendReloadSignal();
        });
    };
    CaptainManager.prototype.forceSsl = function (isEnabled) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getHasRootSsl();
        })
            .then(function (hasRootSsl) {
            if (!hasRootSsl) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "You first need to enable SSL on the root domain before forcing it.");
            }
            return self.dataStore.setForceSsl(isEnabled);
        })
            .then(function () {
            return self.refreshForceSslState();
        });
    };
    CaptainManager.prototype.refreshForceSslState = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getForceSsl();
        })
            .then(function (hasForceSsl) {
            self.hasForceSsl = hasForceSsl;
        });
    };
    CaptainManager.prototype.getForceSslValue = function () {
        return !!this.hasForceSsl;
    };
    /**
     * Returns a promise successfully if verification is succeeded. If it fails, it throws an exception.
     *
     * @param domainName the domain to verify, app.mycaptainroot.com or www.myawesomeapp.com
     * @param identifierSuffix an optional suffix to be added to the identifier file name to avoid name conflict
     *
     * @returns {Promise.<boolean>}
     */
    CaptainManager.prototype.verifyCaptainOwnsDomainOrThrow = function (domainName, identifierSuffix) {
        var self = this;
        var randomUuid = uuid();
        var captainConfirmationPath = CaptainConstants.captainConfirmationPath + (identifierSuffix ? identifierSuffix : '');
        return Promise.resolve()
            .then(function () {
            return self.certbotManager.domainValidOrThrow(domainName);
        })
            .then(function () {
            return fs.outputFile(CaptainConstants.captainStaticFilesDir + CaptainConstants.nginxDomainSpecificHtmlDir
                + '/' + domainName + captainConfirmationPath, randomUuid);
        })
            .then(function () {
            return new Promise(function (resolve) {
                setTimeout(function () {
                    resolve();
                }, 1000);
            });
        })
            .then(function () {
            return new Promise(function (resolve, reject) {
                var url = 'http://' + domainName + ':' +
                    CaptainConstants.nginxPortNumber + captainConfirmationPath;
                request(url, function (error, response, body) {
                    if (error || !body || (body !== randomUuid)) {
                        Logger.e("Verification Failed for " + domainName);
                        Logger.e("Error        " + error);
                        Logger.e("body         " + body);
                        Logger.e("randomUuid   " + randomUuid);
                        reject(ApiStatusCodes.createError(ApiStatusCodes.VERIFICATION_FAILED, 'Verification Failed.'));
                        return;
                    }
                    resolve();
                });
            });
        });
    };
    CaptainManager.prototype.getNginxConfig = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getNginxConfig();
        });
    };
    CaptainManager.prototype.setNginxConfig = function (baseConfig, captainConfig) {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.setNginxConfig(baseConfig, captainConfig);
        })
            .then(function () {
            self.resetSelf();
        });
    };
    CaptainManager.prototype.requestCertificateForDomain = function (domainName) {
        return this.certbotManager.enableSsl(domainName);
    };
    CaptainManager.prototype.verifyDomainResolvesToDefaultServerOnHost = function (domainName) {
        var self = this;
        return new Promise(function (resolve, reject) {
            var url = 'http://' + domainName + CaptainConstants.captainConfirmationPath;
            Logger.d('Sending request to ' + url);
            request(url, function (error, response, body) {
                if (error || !body || (body !== self.loadBalancerManager.getCaptainPublicRandomKey())) {
                    reject(ApiStatusCodes.createError(ApiStatusCodes.VERIFICATION_FAILED, 'Verification Failed.'));
                    return;
                }
                resolve();
            });
        });
    };
    CaptainManager.prototype.changeCaptainRootDomain = function (requestedCustomDomain) {
        var self = this;
        // Some DNS servers do not allow wild cards. Therefore this line may fail.
        // We still allow users to specify the domains in their DNS settings individually
        // SubDomains that need to be added are "captain." "registry." "app-name."
        var url = (CaptainConstants.preCheckForWildCard ? uuid() : CaptainConstants.captainSubDomain) +
            '.' + requestedCustomDomain + ':' +
            CaptainConstants.nginxPortNumber;
        return self.verifyDomainResolvesToDefaultServerOnHost(url)
            .then(function () {
            return self.dataStore.getHasRootSsl();
        })
            .then(function (hasRootSsl) {
            if (hasRootSsl && self.dataStore.getRootDomain() !== requestedCustomDomain) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'SSL is enabled for root. Too late to change your mind!');
            }
            return self.dataStore.setCustomDomain(requestedCustomDomain);
        })
            .then(function () {
            return self.reloadLoadBalancer(self.dataStore);
        });
    };
    CaptainManager.prototype.resetSelf = function () {
        var self = this;
        Logger.d('Captain is resetting itself!');
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                var promiseToIgnore = self.dockerApi.updateService(CaptainConstants.captainServiceName);
            }, 2000);
        });
    };
    return CaptainManager;
}());
var captainManagerInstance = new CaptainManager();
module.exports.get = function () {
    return captainManagerInstance;
};
