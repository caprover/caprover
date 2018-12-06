"use strict";
const fs = require("fs-extra");
const EnvVars = require("./EnvVars");
const CAPTAIN_BASE_DIRECTORY = '/captain';
const CAPTAIN_DATA_DIRECTORY = +CAPTAIN_BASE_DIRECTORY + '/data'; // data that sits here can be backed up
const CAPTAIN_ROOT_DIRECTORY_TEMP = CAPTAIN_BASE_DIRECTORY + '/temp';
const CAPTAIN_ROOT_DIRECTORY_GENERATED = CAPTAIN_BASE_DIRECTORY + '/generated';
const CONSTANT_FILE_OVERRIDE = CAPTAIN_DATA_DIRECTORY + '/override.json';
const configs = {
    publishedNameOnDockerHub: 'dockersaturn/captainduckduck',
    defaultMaxLogSize: '512m',
    buildLogSize: 50,
    preCheckForWildCard: true,
    registrySubDomainPort: 996,
};
let data = {
    configs: configs,
    // ******************** Global Constants *********************
    apiVersion: 'v2',
    version: '0.7.3',
    isDebug: EnvVars.CAPTAIN_IS_DEBUG,
    captainServiceExposedPort: 3000,
    rootNameSpace: 'captain',
    // *********************** Disk Paths ************************
    dockerSocketPath: '/var/run/docker.sock',
    sourcePathInContainer: '/usr/src/app',
    nginxStaticRootDir: '/usr/share/nginx',
    captainStaticFilesDir: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/static',
    nginxSharedPathOnNginx: '/nginx-shared',
    nginxDefaultHtmlDir: '/default',
    letsEncryptEtcPathOnNginx: '/letencrypt/etc',
    nginxDomainSpecificHtmlDir: '/domains',
    captainConfirmationPath: '/.well-known/captain-identifier',
    captainBaseDirectory: CAPTAIN_BASE_DIRECTORY,
    captainRootDirectoryTemp: CAPTAIN_ROOT_DIRECTORY_TEMP,
    captainRawSourceDirectoryBase: CAPTAIN_ROOT_DIRECTORY_TEMP + '/image_raw',
    captainRootDirectoryGenerated: CAPTAIN_ROOT_DIRECTORY_GENERATED,
    registryAuthPathOnHost: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/registry-auth',
    baseNginxConfigPath: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/nginx.conf',
    rootNginxConfigPath: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d/captain-root',
    perAppNginxConfigPathBase: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d',
    captainDataDirectory: CAPTAIN_DATA_DIRECTORY,
    letsEncryptLibPath: CAPTAIN_DATA_DIRECTORY + '/letencrypt/lib',
    letsEncryptEtcPath: CAPTAIN_DATA_DIRECTORY + '/letencrypt/etc',
    registryPathOnHost: CAPTAIN_DATA_DIRECTORY + '/registry',
    nginxSharedPathOnHost: CAPTAIN_DATA_DIRECTORY + '/nginx-shared',
    debugSourceDirectory: '',
    // **************** DockerHub Image Names ********************
    certbotImageName: 'dockersaturn/certbot-sleeping:v0.17.0',
    netDataImageName: 'titpetric/netdata:1.8',
    registryImageName: 'registry:2',
    appPlaceholderImageName: 'dockersaturn/app-placeholder:latest',
    nginxImageName: 'nginx',
    // ********************* Local Docker Constants  ************************
    defaultEmail: 'runner@captainduckduck.com',
    captainSaltSecretKey: 'captain-salt',
    nginxServiceName: 'captain-nginx',
    captainServiceName: 'captain-captain',
    certbotServiceName: 'captain-certbot',
    netDataContainerName: 'captain-netdata-container',
    registryServiceName: 'captain-registry',
    captainNetworkName: 'captain-overlay-network',
    captainRegistryUsername: 'captain',
    // ********************* HTTP Related Constants  ************************
    nginxPortNumber: 80,
    netDataRelativePath: '/net-data-monitor',
    healthCheckEndPoint: '/checkhealth',
    captainSubDomain: 'captain',
    registrySubDomain: 'registry',
    headerCookieAuth: 'captainCookieAuth',
    headerAuth: 'x-captain-auth',
    headerNamespace: 'x-namespace',
};
let overridingValuesConfigs = fs.readJsonSync(CONSTANT_FILE_OVERRIDE, {
    throws: false,
});
if (!!overridingValuesConfigs) {
    for (let prop in overridingValuesConfigs) {
        if (!overridingValuesConfigs.hasOwnProperty(prop)) {
            continue;
        }
        console.log('Overriding ' + prop);
        // @ts-ignore
        configs[prop] = overridingValuesConfigs[prop];
    }
}
if (data.isDebug) {
    let devDirectoryOnLocalMachine = fs
        .readFileSync(__dirname + '/../../currentdirectory')
        .toString()
        .trim();
    if (!devDirectoryOnLocalMachine) {
        throw new Error('For development purposes, you need to assign your local directory here');
    }
    data.debugSourceDirectory = devDirectoryOnLocalMachine;
    data.configs.publishedNameOnDockerHub = 'captain-debug';
    data.nginxPortNumber = 80;
}
module.exports = data;
//# sourceMappingURL=CaptainConstants.js.map