import fs = require('fs-extra')
import path = require('path')
import EnvVars from './EnvVars'

const CAPTAIN_BASE_DIRECTORY = EnvVars.CAPTAIN_BASE_DIRECTORY || '/captain'
const CAPTAIN_DATA_DIRECTORY = CAPTAIN_BASE_DIRECTORY + '/data' // data that sits here can be backed up
const CAPTAIN_ROOT_DIRECTORY_TEMP = CAPTAIN_BASE_DIRECTORY + '/temp'
const CAPTAIN_ROOT_DIRECTORY_GENERATED = CAPTAIN_BASE_DIRECTORY + '/generated'

const CONSTANT_FILE_OVERRIDE_BUILD = path.join(
    __dirname,
    '../../config-override.json'
)
const CONSTANT_FILE_OVERRIDE_USER =
    CAPTAIN_DATA_DIRECTORY + '/config-override.json'

const configs = {
    publishedNameOnDockerHub: 'caprover/caprover',

    version: '1.12.0',

    defaultMaxLogSize: '512m',

    buildLogSize: 50,

    appLogSize: 500,

    maxVersionHistory: 50,

    skipVerifyingDomains: false,

    enableDockerLogsTimestamp: true,

    registrySubDomainPort: 996,

    dockerApiVersion: 'v1.43',

    netDataImageName: 'caprover/netdata:v1.34.1',

    registryImageName: 'registry:2',

    appPlaceholderImageName: 'caprover/caprover-placeholder-app:latest',

    nginxImageName: 'nginx:1.24',

    defaultEmail: 'runner@caprover.com',

    captainSubDomain: 'captain',

    overlayNetworkOverride: {},

    useExistingSwarm: false,

    proApiDomains: ['https://pro.caprover.com'],

    analyticsDomain: 'https://analytics-v1.caprover.com',

    certbotImageName: 'caprover/certbot-sleeping:v2.11.0',

    certbotCertCommandRules: undefined as CertbotCertCommandRule[] | undefined,

    // this is added in 1.13 just as a safety - remove this after 1.14
    disableEncryptedCheck: false,
}

export interface CertbotCertCommandRule {
    /**
     * Matches both *.<domain> and <domain>, use '*' to match all domains
     */
    domain: string
    /**
     * The Certbot command to execute, will be parsed using `shell-quote`, available variables are `${domainName}` and `${subdomain}`
     */
    command?: string
}

const data = {
    configs: configs, // values that can be overridden

    // ******************** Global Constants *********************

    apiVersion: 'v2',

    isDebug: EnvVars.CAPTAIN_IS_DEBUG,

    captainServiceExposedPort: 3000,

    rootNameSpace: 'captain',

    // *********************** Disk Paths ************************

    defaultCaptainDefinitionPath: './captain-definition',

    dockerSocketPath: '/var/run/docker.sock',

    sourcePathInContainer: '/usr/src/app',

    nginxStaticRootDir: '/usr/share/nginx',

    captainStaticFilesDir: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/static',

    nginxSharedPathOnNginx: '/nginx-shared',

    nginxDhParamFileName: 'dhparam.pem',

    nginxDefaultHtmlDir: '/default',

    letsEncryptEtcPathOnNginx: '/letencrypt/etc',

    nginxDomainSpecificHtmlDir: '/domains',

    captainConfirmationPath: '/.well-known/captain-identifier',

    captainBaseDirectory: CAPTAIN_BASE_DIRECTORY,

    restoreTarFilePath: CAPTAIN_BASE_DIRECTORY + '/backup.tar',

    restoreDirectoryPath: CAPTAIN_BASE_DIRECTORY + '/restoring',

    captainRootDirectoryTemp: CAPTAIN_ROOT_DIRECTORY_TEMP,

    captainRootDirectoryBackup: CAPTAIN_ROOT_DIRECTORY_TEMP + '/backup',

    captainDownloadsDirectory: CAPTAIN_ROOT_DIRECTORY_TEMP + '/downloads',

    captainRawSourceDirectoryBase: CAPTAIN_ROOT_DIRECTORY_TEMP + '/image_raw',

    captainRootDirectoryGenerated: CAPTAIN_ROOT_DIRECTORY_GENERATED,

    registryAuthPathOnHost: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/registry-auth', // this is a file

    baseNginxConfigPath: CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/nginx.conf', // this is a file

    rootNginxConfigPath:
        CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d/captain-root',

    perAppNginxConfigPathBase:
        CAPTAIN_ROOT_DIRECTORY_GENERATED + '/nginx/conf.d',

    captainDataDirectory: CAPTAIN_DATA_DIRECTORY,

    letsEncryptLibPath: CAPTAIN_DATA_DIRECTORY + '/letencrypt/lib',

    letsEncryptEtcPath: CAPTAIN_DATA_DIRECTORY + '/letencrypt/etc',

    registryPathOnHost: CAPTAIN_DATA_DIRECTORY + '/registry',

    nginxSharedPathOnHost: CAPTAIN_DATA_DIRECTORY + '/nginx-shared',

    debugSourceDirectory: '', // Only used in debug mode

    // ********************* Local Docker Constants  ************************

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

    registrySubDomain: 'registry',

    headerCookieAuth: 'captainCookieAuth',

    headerAuth: 'x-captain-auth',

    headerAppToken: 'x-captain-app-token',

    headerNamespace: 'x-namespace',

    headerCapRoverVersion: 'x-caprover-version',

    // *********************     ETC       ************************

    disableFirewallCommand:
        'ufw allow 80,443,3000,996,7946,4789,2377/tcp; ufw allow 7946,4789,2377/udp; ',

    gitShaEnvVarKey: 'CAPROVER_GIT_COMMIT_SHA',
}

function overrideConfigFromFile(fileName: string) {
    const overridingValuesConfigs = fs.readJsonSync(fileName, {
        throws: false,
    })

    if (overridingValuesConfigs) {
        for (const prop in overridingValuesConfigs) {
            // eslint-disable-next-line no-prototype-builtins
            if (!overridingValuesConfigs.hasOwnProperty(prop)) {
                continue
            }

            console.log(`Overriding ${prop} from ${fileName}`)
            // @ts-expect-error "this actually works"
            configs[prop] = overridingValuesConfigs[prop]
        }
    }
}

overrideConfigFromFile(CONSTANT_FILE_OVERRIDE_BUILD)

overrideConfigFromFile(CONSTANT_FILE_OVERRIDE_USER)

if (data.isDebug) {
    const devDirectoryOnLocalMachine = fs
        .readFileSync(__dirname + '/../../currentdirectory')
        .toString()
        .trim()

    if (!devDirectoryOnLocalMachine) {
        throw new Error(
            'For development purposes, you need to assign your local directory here'
        )
    }

    data.debugSourceDirectory = devDirectoryOnLocalMachine
    data.configs.publishedNameOnDockerHub = 'captain-debug'
    data.nginxPortNumber = 80
}

export default data
