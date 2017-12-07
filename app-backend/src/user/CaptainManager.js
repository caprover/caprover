const uuid = require('uuid/v4');
const DockerApi = require('../docker/DockerApi');
const CaptainConstants = require('../utils/CaptainConstants');
const Logger = require('../utils/Logger');
const fs = require('fs-extra');
const LoadBalancerManager = require('./LoadBalancerManager');
const EnvVars = require('../utils/EnvVars');
const CertbotManager = require('./CertbotManager');
const DockerRegistry = require('./DockerRegistry');
const request = require('request');
const ApiStatusCodes = require('../api/ApiStatusCodes');
const SshClient = require('ssh2').Client;
const DataStoreProvider = require('../datastore/DataStoreProvider');

const DEBUG_SALT = 'THIS IS NOT A REAL CERTIFICATE';

const MAX_FAIL_ALLOWED = 6;
const HEALTH_CHECK_INTERVAL = 5000;//ms

class CaptainManager {

    constructor() {

        let dockerApi = DockerApi.get();

        this.dataStore = DataStoreProvider.getDataStore(CaptainConstants.rootNameSpace);
        this.dockerApi = dockerApi;
        this.certbotManager = new CertbotManager(dockerApi);
        this.loadBalancerManager = new LoadBalancerManager(dockerApi, this.certbotManager);
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

    initialize() {

        // If a linked file / directory is deleted on the host, it loses the connection to
        // the container and needs an update to be picked up again.

        const self = this;
        const dataStore = this.dataStore;
        const dockerApi = this.dockerApi;
        const loadBalancerManager = this.loadBalancerManager;
        const certbotManager = this.certbotManager;
        let myNodeId = null;

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

                return dockerApi.ensureServiceConnectedToNetwork(CaptainConstants.captainServiceName,
                    CaptainConstants.captainNetworkName);

            })
            .then(function () {

                return loadBalancerManager.init(myNodeId, dataStore);

            })
            .then(function () {

                let valueIfNotExist = CaptainConstants.isDebug ? DEBUG_SALT : uuid();
                return dockerApi.ensureSecret(CaptainConstants.captainSaltSecretKey, valueIfNotExist);

            })
            .then(function () {

                return dockerApi.ensureSecretOnService(CaptainConstants.captainServiceName, CaptainConstants.captainSaltSecretKey);

            })
            .then(function (secretHadExistedBefore) {

                if (!secretHadExistedBefore) {
                    return new Promise(function () {
                        Logger.d('I am halting here. I expect to get restarted in a few seconds due to a secret (captain salt) being updated.')
                    });
                }

                return dataStore.getRegistryAuthSecretVersion();

            })
            .then(function (currentVersion) {

                let secretName = CaptainConstants.captainRegistryAuthHeaderSecretPrefix + currentVersion;

                if (currentVersion > 0) {
                    Logger.d('Updating secrets to update docker registry auth.');
                    return dockerApi
                        .ensureSecretOnService(CaptainConstants.captainServiceName, secretName)
                        .then(function (secretHadExistedBefore) {

                            if (!secretHadExistedBefore) {
                                return new Promise(function () {
                                    Logger.d('I am halting here. I expect to get restarted in a few seconds due to a secret (registry auth) being updated.')
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

                let secretName = CaptainConstants.captainRegistryAuthHeaderSecretPrefix + currentVersion;

                const secretFileName = '/run/secrets/' + secretName;

                if (!fs.existsSync(secretFileName)) {
                    throw new Error('Secret is attached according to Docker. But file cannot be found. ' + secretFileName);
                }

                let secretContent = fs.readFileSync(secretFileName).toString();

                if (!secretContent) {
                    throw new Error('Docker Auth content is empty!');
                }

                self.dockerAuthObj = JSON.parse(secretContent);

                return true;

            })
            .then(function () {

                const secretFileName = '/run/secrets/' + CaptainConstants.captainSaltSecretKey;

                if (!fs.existsSync(secretFileName)) {

                    if (CaptainConstants.isDebug) {
                        Logger.d('SECURITY WARNING! Setting the salt to default! Perhaps you are running the code outside of the container?');
                        self.captainSalt = DEBUG_SALT;
                        return true;
                    }

                    throw new Error('Secret is attached according to Docker. But file cannot be found. ' + secretFileName);
                }

                let secretContent = fs.readFileSync(secretFileName).toString();

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

            })

    }

    performHealthCheck() {

        const self = this;
        const captainPublicDomain = CaptainConstants.captainSubDomain + '.' + self.dataStore.getRootDomain();

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

            let url = 'http://' + captainPublicDomain + CaptainConstants.healthCheckEndPoint;

            request(url,

                function (error, response, body) {

                    if (error || !body || (body !== self.getHealthCheckUuid())) {
                        callback(false);
                    }
                    else {
                        callback(true);
                    }

                });
        }

        function checkNginxHealth(callback) {

            self.verifyCaptainOwnsDomainOrThrow(captainPublicDomain, '-healthcheck')
                .then(function () {
                    callback(true);
                })
                .catch(function () {
                    callback(false);
                });
        }

        let checksPerformed = {};

        function scheduleIfNecessary() {

            if (!checksPerformed.captainHealth || !checksPerformed.nginxHealth) {
                return;
            }

            let hasFailedCheck = false;

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
            checksPerformed.captainHealth = {value: success};
            scheduleIfNecessary();
        });

        checkNginxHealth(function (success) {
            checksPerformed.nginxHealth = {value: success};
            scheduleIfNecessary();
        });
    }

    getHealthCheckUuid() {
        return this.healthCheckUuid;
    }

    isInitialized() {
        return this.inited && !this.waitUntilRestarted;
    }

    getCaptainImageTags() {

        let url = 'https://hub.docker.com/v2/repositories/' + CaptainConstants.publishedNameOnDockerHub + '/tags';

        return new Promise(function (resolve, reject) {

            request(url,

                function (error, response, body) {

                    if (error) {
                        reject(error);
                    }
                    else if (!body || !JSON.parse(body).results) {
                        reject(new Error('Received empty body or no result for version list on docker hub.'));
                    }
                    else {
                        let results = JSON.parse(body).results;
                        let tags = [];
                        for (let idx = 0; idx < results.length; idx++) {
                            tags.push(results[idx].name);
                        }
                        resolve(tags);
                    }
                });
        })
    }

    updateCaptain(versionTag) {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.dockerApi.updateService(CaptainConstants.captainServiceName,
                    CaptainConstants.publishedNameOnDockerHub + ':' + versionTag);
            })
    }

    getMyNodeId() {
        if (!this.myNodeId) {
            let msg = 'myNodeId is not set yet!!';
            Logger.e(msg);
            throw new Error(msg);
        }

        return this.myNodeId;
    }

    getCaptainSalt() {

        if (!this.captainSalt) {
            let msg = 'Captain Salt is not set yet!!';
            Logger.e(msg);
            throw new Error(msg);
        }

        return this.captainSalt;
    }

    getDockerAuthObject() {
        return this.dockerAuthObj;
    }

    updateNetDataInfo(netDataInfo) {

        const self = this;
        const dockerApi = this.dockerApi;

        return Promise.resolve()
            .then(function () {

                return dockerApi.ensureContainerStoppedAndRemoved(CaptainConstants.netDataContainerName);

            })
            .then(function () {

                if (netDataInfo.isEnabled) {
                    let vols = [
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

                    let envVars = [];

                    if (netDataInfo.smtp) {
                        envVars.push({
                            key: 'SSMTP_TO',
                            value: netDataInfo.smtp.to
                        });
                        envVars.push({
                            key: 'SSMTP_HOSTNAME',
                            value: netDataInfo.smtp.hostname
                        });

                        envVars.push({
                            key: 'SSMTP_SERVER',
                            value: netDataInfo.smtp.server
                        });

                        envVars.push({
                            key: 'SSMTP_PORT',
                            value: netDataInfo.smtp.port
                        });

                        envVars.push({
                            key: 'SSMTP_TLS',
                            value: netDataInfo.smtp.allowNonTls ? 'NO' : 'YES'
                        });

                        envVars.push({
                            key: 'SSMTP_USER',
                            value: netDataInfo.smtp.username
                        });

                        envVars.push({
                            key: 'SSMTP_PASS',
                            value: netDataInfo.smtp.password
                        });
                    }

                    if (netDataInfo.slack) {
                        envVars.push({
                            key: 'SLACK_WEBHOOK_URL',
                            value: netDataInfo.slack.hook
                        });
                        envVars.push({
                            key: 'SLACK_CHANNEL',
                            value: netDataInfo.slack.channel
                        });
                    }

                    if (netDataInfo.telegram) {
                        envVars.push({
                            key: 'TELEGRAM_BOT_TOKEN',
                            value: netDataInfo.telegram.botToken
                        });
                        envVars.push({
                            key: 'TELEGRAM_CHAT_ID',
                            value: netDataInfo.telegram.chatId
                        });
                    }

                    if (netDataInfo.pushBullet) {
                        envVars.push({
                            key: 'PUSHBULLET_ACCESS_TOKEN',
                            value: netDataInfo.pushBullet.apiToken
                        });
                        envVars.push({
                            key: 'PUSHBULLET_DEFAULT_EMAIL',
                            value: netDataInfo.pushBullet.fallbackEmail
                        });
                    }

                    return dockerApi.createStickyContainer(CaptainConstants.netDataContainerName,
                        CaptainConstants.netDataImageName, vols, CaptainConstants.captainNetworkName, envVars, ['SYS_PTRACE']);
                }

                // Just removing the old container. No need to create a new one.
                return true;
            })
            .then(function () {

                return self.dataStore.setNetDataInfo(netDataInfo);

            });
    }

    getNodesInfo() {

        const dockerApi = this.dockerApi;

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
    }

    joinDockerNode(captainIpAddress, isManager, remoteNodeIpAddress, remoteUserName, privateKey) {

        const dockerApi = this.dockerApi;

        return Promise.resolve()
            .then(function () {
                return dockerApi.getJoinToken(isManager);
            })
            .then(function (token) {

                return new Promise(function (resolve, reject) {
                    const conn = new SshClient();
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

                                let hasExisted = false;

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
            })
    }

    getLoadBalanceManager() {
        return this.loadBalancerManager;
    }

    reloadLoadBalancer(ds) {
        const self = this;
        return self.loadBalancerManager.rePopulateNginxConfigFile(ds)
            .then(function () {
                Logger.d('sendReloadSignal...');
                return self.loadBalancerManager.sendReloadSignal();
            });
    }

    getDockerRegistry() {
        return this.dockerRegistry;
    }

    enableSsl(emailAddress) {
        const self = this;
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

    }

    forceSsl(isEnabled) {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.dataStore.getHasRootSsl();
            })
            .then(function (hasRootSsl) {

                if (!hasRootSsl) {
                    throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, "You first need to enable SSL on the root domain before forcing it.")
                }

                return self.dataStore.setForceSsl(isEnabled);
            })
            .then(function () {
                return self.refreshForceSslState();
            });
    }

    refreshForceSslState() {
        const self = this;
        return Promise.resolve()
            .then(function () {
                return self.dataStore.getForceSsl();
            })
            .then(function (hasForceSsl) {
                self.hasForceSsl = hasForceSsl;
            });
    }

    getForceSslValue() {
        return this.hasForceSsl;
    }

    /**
     * Returns a promise successfully if verification is succeeded. If it fails, it throws an exception.
     *
     * @param domainName the domain to verify, app.mycaptainroot.com or www.myawesomeapp.com
     * @param identifierSuffix an optional suffix to be added to the identifier file name to avoid name conflict
     *
     * @returns {Promise.<boolean>}
     */
    verifyCaptainOwnsDomainOrThrow(domainName, identifierSuffix) {

        const self = this;
        const randomUuid = uuid();
        let captainConfirmationPath = CaptainConstants.captainConfirmationPath + (identifierSuffix ? identifierSuffix : '');

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
                })

            })
            .then(function () {

                return new Promise(
                    function (resolve, reject) {
                        let url = 'http://' + domainName + ':' +
                            CaptainConstants.nginxPortNumber + captainConfirmationPath;

                        request(url,

                            function (error, response, body) {

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
                    })

            })
    }


    requestCertificateForDomain(domainName) {
        return this.certbotManager.enableSsl(domainName);
    }

    verifyDomainResolvesToDefaultServerOnHost(domainName) {
        const self = this;
        return new Promise(
            function (resolve, reject) {

                let url = 'http://' + domainName + CaptainConstants.captainConfirmationPath;

                Logger.d('Sending request to ' + url);

                request(url,
                    function (error, response, body) {

                        if (error || !body || (body !== self.loadBalancerManager.getCaptainPublicRandomKey())) {
                            reject(ApiStatusCodes.createError(ApiStatusCodes.VERIFICATION_FAILED, 'Verification Failed.'));
                            return;
                        }

                        resolve();
                    });
            });
    }

    changeCaptainRootDomain(requestedCustomDomain) {

        const self = this;
        let url = uuid() + '.' + requestedCustomDomain + ':' +
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
    }

    resetSelf() {
        const self = this;
        Logger.d('Captain is resetting itself!');
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                let promiseToIgnore = self.dockerApi.updateService(CaptainConstants.captainServiceName);
            }, 2000);
        })
    }
}

const captainManagerInstance = new CaptainManager();

module.exports.get = function () {
    return captainManagerInstance;
};
