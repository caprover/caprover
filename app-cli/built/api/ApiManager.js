"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const HttpClient_1 = require("./HttpClient");
class ApiManager {
    constructor(baseUrl, authTokenSaver) {
        this.authTokenSaver = authTokenSaver;
        const self = this;
        this.http = new HttpClient_1.default(baseUrl, ApiManager.authToken, function () {
            return self.getAuthToken(ApiManager.lastKnownPassword);
        });
    }
    destroy() {
        this.http.destroy();
    }
    setAuthToken(authToken) {
        ApiManager.authToken = authToken;
        this.http.setAuthToken(authToken);
    }
    static isLoggedIn() {
        return !!ApiManager.authToken;
    }
    getAuthToken(password) {
        const http = this.http;
        ApiManager.lastKnownPassword = password;
        let authTokenFetched = '';
        const self = this;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/login', { password }))
            .then(function (data) {
            authTokenFetched = data.token;
            self.setAuthToken(authTokenFetched);
            return authTokenFetched;
        })
            .then(self.authTokenSaver)
            .then(function () {
            return authTokenFetched;
        });
    }
    getCaptainInfo() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/info', {}));
    }
    updateRootDomain(rootDomain) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/changerootdomain', { rootDomain }));
    }
    enableRootSsl(emailAddress) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/enablessl', { emailAddress }));
    }
    forceSsl(isEnabled) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/forcessl', { isEnabled }));
    }
    getAllApps() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/appDefinitions', {})); // TODO user/apps/appDefinitions
    }
    fetchBuildLogs(appName) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/appData/' + appName, {})); // TODO user/apps/appData
    }
    uploadAppData(appName, file) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST_DATA, '/user/appData/' + appName + '?detached=1', { sourceFile: file })); // TODO user/apps/appData
    }
    uploadCaptainDefinitionContent(appName, captainDefinition, gitHash, detached) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appData/' + appName + (detached ? '?detached=1' : ''), {
            captainDefinitionContent: JSON.stringify(captainDefinition),
            gitHash
        }));
    }
    updateConfigAndSave(appName, appDefinition) {
        var instanceCount = appDefinition.instanceCount;
        var envVars = appDefinition.envVars;
        var notExposeAsWebApp = appDefinition.notExposeAsWebApp;
        var forceSsl = appDefinition.forceSsl;
        var volumes = appDefinition.volumes;
        var ports = appDefinition.ports;
        var nodeId = appDefinition.nodeId;
        var appPushWebhook = appDefinition.appPushWebhook;
        var customNginxConfig = appDefinition.customNginxConfig;
        var preDeployFunction = appDefinition.preDeployFunction;
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/update', {
            appName: appName,
            instanceCount: instanceCount,
            notExposeAsWebApp: notExposeAsWebApp,
            forceSsl: forceSsl,
            volumes: volumes,
            ports: ports,
            customNginxConfig: customNginxConfig,
            appPushWebhook: appPushWebhook,
            nodeId: nodeId,
            preDeployFunction: preDeployFunction,
            envVars: envVars
        }));
    }
    registerNewApp(appName, hasPersistentData) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/register', {
            appName,
            hasPersistentData
        }));
    }
    deleteApp(appName) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/delete', {
            appName
        }));
    }
    enableSslForBaseDomain(appName) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/enablebasedomainssl', {
            appName
        }));
    }
    attachNewCustomDomainToApp(appName, customDomain) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/customdomain', {
            appName,
            customDomain
        }));
    }
    enableSslForCustomDomain(appName, customDomain) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/enablecustomdomainssl', {
            appName,
            customDomain
        }));
    }
    removeCustomDomain(appName, customDomain) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/removecustomdomain', {
            appName,
            customDomain
        }));
    }
    getLoadBalancerInfo() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/loadbalancerinfo', {}));
    }
    getNetDataInfo() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/netdata', {}));
    }
    updateNetDataInfo(netDataInfo) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/netdata', { netDataInfo }));
    }
    changePass(oldPassword, newPassword) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/changepassword', {
            oldPassword,
            newPassword
        }));
    }
    getVersionInfo() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/versioninfo', {}));
    }
    performUpdate(latestVersion) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/versioninfo', { latestVersion }));
    }
    getNginxConfig() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/nginxconfig', {}));
    }
    setNginxConfig(customBase, customCaptain) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/nginxconfig', {
            baseConfig: { customValue: customBase },
            captainConfig: { customValue: customCaptain }
        }));
    }
    getUnusedImages(mostRecentLimit) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/apps/appDefinitions/unusedImages', {
            mostRecentLimit: mostRecentLimit + ''
        }));
    }
    deleteImages(imageIds) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/apps/appDefinitions/deleteImages', {
            imageIds
        }));
    }
    getDockerRegistries() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/registries', {}));
    }
    enableSelfHostedDockerRegistry() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/selfhostregistry/enableregistry', {}));
    }
    disableSelfHostedDockerRegistry() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/selfhostregistry/disableregistry', {}));
    }
    addDockerRegistry(dockerRegistry) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/registries/insert', Object.assign({}, dockerRegistry)));
    }
    updateDockerRegistry(dockerRegistry) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/registries/update', Object.assign({}, dockerRegistry)));
    }
    deleteDockerRegistry(registryId) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/registries/delete', {
            registryId
        }));
    }
    setDefaultPushDockerRegistry(registryId) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/registries/setpush', {
            registryId
        }));
    }
    getAllNodes() {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.GET, '/user/system/nodes', {}));
    }
    addDockerNode(nodeType, privateKey, remoteNodeIpAddress, captainIpAddress) {
        const http = this.http;
        return Promise.resolve() //
            .then(http.fetch(http.POST, '/user/system/nodes', {
            nodeType,
            privateKey,
            remoteNodeIpAddress,
            captainIpAddress
        }));
    }
}
ApiManager.lastKnownPassword = process.env.REACT_APP_DEFAULT_PASSWORD
    ? process.env.REACT_APP_DEFAULT_PASSWORD + ''
    : 'captain42';
ApiManager.authToken = !!process.env.REACT_APP_IS_DEBUG
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7Im5hbWVzcGFjZSI6ImNhcHRhaW4iLCJ0b2tlblZlcnNpb24iOiI5NmRjM2U1MC00ZDk3LTRkNmItYTIzMS04MmNiZjY0ZTA2NTYifSwiaWF0IjoxNTQ1OTg0MDQwLCJleHAiOjE1ODE5ODQwNDB9.uGJyhb2JYsdw9toyMKX28bLVuB0PhnS2POwEjKpchww'
    : '';
exports.default = ApiManager;
//# sourceMappingURL=ApiManager.js.map