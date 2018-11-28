import fs = require('fs-extra')
import EnvVars = require('./EnvVars')

const CAPTAIN_ROOT_DIRECTORY = '/captain'
const CONSTANT_FILE_OVERRIDE = CAPTAIN_ROOT_DIRECTORY + '/constants.conf'
const CAPTAIN_ROOT_DIRECTORY_TEMP = CAPTAIN_ROOT_DIRECTORY + '/temp'
const CAPTAIN_ROOT_DIRECTORY_GENERATED = CAPTAIN_ROOT_DIRECTORY + '/generated'

let data = {
    apiVersion: 'v1',

    publishedNameOnDockerHub: 'dockersaturn/captainduckduck',

    certbotImageName: 'dockersaturn/certbot-sleeping:v0.17.0',

    netDataImageName: 'titpetric/netdata:1.8',

    registryImageName: 'registry:2',

    appPlaceholderImageName: 'dockersaturn/app-placeholder:latest',

    nginxImageName: 'nginx',

    defaultEmail: 'runner@captainduckduck.com',

    defaultMaxLogSize: '512m',

    isDebug: EnvVars.CAPTAIN_IS_DEBUG,

    version: '0.7.3',

    captainSaltSecretKey: 'captain-salt',

    nginxServiceName: 'captain-nginx',

    nginxPortNumber: 80,

    rootNameSpace: 'captain',

    captainServiceName: 'captain-captain',

    certbotServiceName: 'captain-certbot',

    netDataContainerName: 'captain-netdata-container',

    netDataRelativePath: '/net-data-monitor',

    preCheckForWildCard: true,

    captainSubDomain: 'captain',

    registrySubDomain: 'registry',

    registryServiceName: 'captain-registry',

    registrySubDomainPort: 996,

    captainRegistryAuthHeaderSecretPrefix: 'captain-reg-auth',

    captainRegistryUsername: 'captain',

    captainNetworkName: 'captain-overlay-network',

    header: {
        cookieAuth: 'captainCookieAuth',
        auth: 'x-captain-auth',
        namespace: 'x-namespace',
    },

    healthCheckEndPoint: '/checkhealth',

    prefixManagerNode: 'captainManager',

    prefixWorkerNode: 'captainWorker',

    dockerSocketPath: '/var/run/docker.sock',

    sourcePathInContainer: '/usr/src/app',

    captainServiceExposedPort: 3000,

    nginxStaticRootDir: '/usr/share/nginx',

    nginxDefaultHtmlDir: '/default',

    nginxDomainSpecificHtmlDir: '/domains',

    captainConfirmationPath: '/.well-known/captain-identifier',

    captainRootDirectory: CAPTAIN_ROOT_DIRECTORY,

    captainRootDirectoryTemp: CAPTAIN_ROOT_DIRECTORY_TEMP,

    captainRootDirectoryGenerated: CAPTAIN_ROOT_DIRECTORY_GENERATED,

    letsEncryptLibPath: CAPTAIN_ROOT_DIRECTORY + '/letencrypt/lib',

    letsEncryptEtcPath: CAPTAIN_ROOT_DIRECTORY + '/letencrypt/etc',

    registryPathOnHost: CAPTAIN_ROOT_DIRECTORY + '/registry',

    registryAuthPathOnHost: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/registry-auth', // this is a file

    nginxSharedPathOnHost: CAPTAIN_ROOT_DIRECTORY + '/nginx-shared',

    letsEncryptEtcPathOnNginx: '/letencrypt/etc',

    nginxSharedPathOnNginx: '/nginx-shared',

    captainStaticFilesDir: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/static',

    captainRawImagesDir: CAPTAIN_ROOT_DIRECTORY_TEMP + '/img_raw',

    captainTarImagesDir: CAPTAIN_ROOT_DIRECTORY_TEMP + '/img_tar',

    captainDefinitionTempDir:
        CAPTAIN_ROOT_DIRECTORY_TEMP + '/captain_definition',

    baseNginxConfigPath: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/nginx.conf',

    rootNginxConfigPath:
        CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d/captain-root',

    perAppNginxConfigPathBase:
        CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d',

    debugSourceDirectory: '', // Only used in debug mode
}

let overridingValues = fs.readJsonSync(CONSTANT_FILE_OVERRIDE, {
    throws: false,
})

if (!!overridingValues) {
    for (let prop in overridingValues) {
        if (!overridingValues.hasOwnProperty(prop)) {
            continue
        }

        console.log('Overriding ' + prop)
        // @ts-ignore
        data[prop] = overridingValues[prop]
    }
}

if (data.isDebug) {
    let devDirectoryOnLocalMachine = fs
        .readFileSync(__dirname + '/../../currentdirectory')
        .toString()
        .trim()

    if (!devDirectoryOnLocalMachine) {
        throw new Error(
            'For development purposes, you need to assign your local directory here'
        )
    }

    data.debugSourceDirectory = devDirectoryOnLocalMachine
    data.publishedNameOnDockerHub = 'captain-debug'
    data.nginxPortNumber = 80
}

export = data
