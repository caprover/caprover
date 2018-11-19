var CaptainConstants = require('../utils/CaptainConstants');
var Logger = require('../utils/Logger');
var EnvVars = require('../utils/EnvVars');
var fs = require('fs-extra');
var uuid = require('uuid/v4');
var ApiStatusCodes = require('../api/ApiStatusCodes');
var bcrypt = require('bcryptjs');
var DockerRegistry = /** @class */ (function () {
    function DockerRegistry(dockerApi, dataStore, certbotManager, loadBalancerManager, captainManager) {
        this.dockerApi = dockerApi;
        this.dataStore = dataStore;
        this.certbotManager = certbotManager;
        this.loadBalancerManager = loadBalancerManager;
        this.captainManager = captainManager;
    }
    DockerRegistry.prototype.enableLocalDockerRegistry = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.setHasLocalRegistry(true);
        });
    };
    DockerRegistry.prototype.enableRegistrySsl = function () {
        var self = this;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getHasRootSsl();
        })
            .then(function (rootHasSsl) {
            if (!rootHasSsl) {
                throw ApiStatusCodes.createError(ApiStatusCodes.ILLEGAL_OPERATION, 'Root must have SSL before enabling ssl for docker registry.');
            }
            return self.certbotManager.enableSsl(CaptainConstants.registrySubDomain + '.' + self.dataStore.getRootDomain());
        })
            .then(function () {
            return self.dataStore.setHasRegistrySsl(true);
        })
            .then(function () {
            return self.loadBalancerManager.rePopulateNginxConfigFile(self.dataStore);
        })
            .then(function () {
            return self.loadBalancerManager.sendReloadSignal();
        });
    };
    DockerRegistry.prototype.getLocalRegistryDomainAndPort = function () {
        var self = this;
        return CaptainConstants.registrySubDomain + '.'
            + self.dataStore.getRootDomain()
            + ':' + CaptainConstants.registrySubDomainPort;
    };
    DockerRegistry.prototype.ensureDockerRegistryRunningOnThisNode = function () {
        var dockerApi = this.dockerApi;
        var dataStore = this.dataStore;
        var myNodeId = this.captainManager.getMyNodeId();
        var captainSalt = this.captainManager.getCaptainSalt();
        function createRegistryServiceOnNode() {
            return dockerApi.createServiceOnNodeId(CaptainConstants.registryImageName, CaptainConstants.registryServiceName, [{
                    protocol: 'tcp',
                    containerPort: 5000,
                    hostPort: CaptainConstants.registrySubDomainPort
                }], myNodeId, [
                {
                    containerPath: '/cert-files',
                    hostPath: CaptainConstants.letsEncryptEtcPath
                },
                {
                    containerPath: '/var/lib/registry',
                    hostPath: CaptainConstants.registryPathOnHost
                },
                {
                    containerPath: '/etc/auth',
                    hostPath: CaptainConstants.registryAuthPathOnHost
                }
            ], [{
                    key: 'REGISTRY_HTTP_TLS_CERTIFICATE',
                    value: '/cert-files/live/' + CaptainConstants.registrySubDomain + '.' + dataStore.getRootDomain() + '/fullchain.pem'
                }, {
                    key: 'REGISTRY_HTTP_TLS_KEY',
                    value: '/cert-files/live/' + CaptainConstants.registrySubDomain + '.' + dataStore.getRootDomain() + '/privkey.pem'
                }, {
                    key: 'REGISTRY_AUTH',
                    value: 'htpasswd'
                }, {
                    key: 'REGISTRY_AUTH_HTPASSWD_REALM',
                    value: 'Registry Realm'
                }, {
                    key: 'REGISTRY_AUTH_HTPASSWD_PATH',
                    value: '/etc/auth'
                }]);
        }
        return Promise.resolve()
            .then(function () {
            var authContent = CaptainConstants.captainRegistryUsername + ':' +
                bcrypt.hashSync(captainSalt, bcrypt.genSaltSync(5));
            return fs.outputFile(CaptainConstants.registryAuthPathOnHost, authContent);
        })
            .then(function () {
            return dockerApi
                .isServiceRunningByName(CaptainConstants.registryServiceName);
        })
            .then(function (isRunning) {
            if (isRunning) {
                Logger.d('Captain Registry is already running.. ');
                return dockerApi
                    .getNodeIdByServiceName(CaptainConstants.registryServiceName);
            }
            else {
                Logger.d('No Captain Registry service is running. Creating one...');
                return createRegistryServiceOnNode(myNodeId)
                    .then(function () {
                    return myNodeId;
                });
            }
        })
            .then(function (nodeId) {
            if (nodeId !== myNodeId) {
                Logger.d('Captain Registry is running on a different node. Removing...');
                return dockerApi
                    .removeServiceByName(CaptainConstants.registryServiceName)
                    .then(function () {
                    Logger.d('Creating Registry on this node...');
                    return createRegistryServiceOnNode(myNodeId)
                        .then(function () {
                        return true;
                    });
                });
            }
            else {
                return true;
            }
        });
    };
    DockerRegistry.prototype.updateRegistryAuthHeader = function (username, password, domain, currentVersion) {
        var self = this;
        var dockerApi = this.dockerApi;
        var nextVersion = null;
        var secretName = null;
        var userEmailAddress;
        return Promise.resolve()
            .then(function () {
            return self.dataStore.getUserEmailAddress();
        })
            .then(function (emailAddress) {
            userEmailAddress = emailAddress;
            if (currentVersion) {
                return currentVersion;
            }
            return self.dataStore.getRegistryAuthSecretVersion();
        })
            .then(function (versionSaved) {
            nextVersion = versionSaved + 1;
            secretName = CaptainConstants.captainRegistryAuthHeaderSecretPrefix + nextVersion;
            if (!username || !password || !domain) {
                throw ApiStatusCodes.createError(ApiStatusCodes.STATUS_ERROR_GENERIC, 'user, pass and domain are all required');
            }
            return dockerApi.checkIfSecretExist(secretName);
        })
            .then(function (secretExist) {
            if (secretExist) {
                Logger.d('WARNING! Unexpected secret exist! Perhaps secret was created but Captain was not updated.');
                return self.updateRegistryAuthHeader(username, password, domain, nextVersion);
            }
            else {
                return dockerApi
                    .ensureSecret(secretName, JSON.stringify({
                    username: username,
                    password: password,
                    email: userEmailAddress || CaptainConstants.defaultEmail,
                    serveraddress: domain
                }))
                    .then(function () {
                    Logger.d('Updating EnvVars to update docker registry auth.');
                    return self.dataStore.setRegistryAuthSecretVersion(nextVersion);
                });
            }
        });
    };
    return DockerRegistry;
}());
module.exports = DockerRegistry;
