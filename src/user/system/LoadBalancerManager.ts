import ejs = require('ejs')
import * as chileProcess from 'child_process'
import * as path from 'path'
import * as util from 'util'
import { v4 as uuid } from 'uuid'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import DataStore from '../../datastore/DataStore'
import DockerApi from '../../docker/DockerApi'
import { IAllAppDefinitions } from '../../models/AppDefinition'
import { IServerBlockDetails } from '../../models/IServerBlockDetails'
import LoadBalancerInfo from '../../models/LoadBalancerInfo'
import { AnyError } from '../../models/OtherTypes'
import CaptainConstants from '../../utils/CaptainConstants'
import Logger from '../../utils/Logger'
import CertbotManager from './CertbotManager'
import fs = require('fs-extra')
import request = require('request')
const exec = util.promisify(chileProcess.exec)

const defaultPageTemplate = fs
    .readFileSync(__dirname + '/../../../template/default-page.ejs')
    .toString()

const CONTAINER_PATH_OF_CONFIG = '/etc/nginx/conf.d'

const NGINX_CONTAINER_PATH_OF_FAKE_CERTS = '/etc/nginx/fake-certs'
const CAPROVER_CONTAINER_PATH_OF_FAKE_CERTS =
    __dirname + '/../../../template/fake-certs-src'
const HOST_PATH_OF_FAKE_CERTS =
    CaptainConstants.captainRootDirectoryGenerated +
    '/nginx/fake-certs-self-signed'

if (!fs.existsSync(CAPROVER_CONTAINER_PATH_OF_FAKE_CERTS))
    throw new Error('CAPROVER_CONTAINER_PATH_OF_FAKE_CERTS  is empty')
if (!defaultPageTemplate) throw new Error('defaultPageTemplate  is empty')

const DH_PARAMS_FILE_PATH_ON_HOST = path.join(
    CaptainConstants.nginxSharedPathOnHost,
    CaptainConstants.nginxDhParamFileName
)

const DH_PARAMS_FILE_PATH_ON_NGINX = path.join(
    CaptainConstants.nginxSharedPathOnNginx,
    CaptainConstants.nginxDhParamFileName
)

class LoadBalancerManager {
    private reloadInProcess: boolean
    private requestedReloadPromises: {
        resolveFunc: VoidFunction
        rejectFunc: (reason: any) => void
    }[]
    private captainPublicRandomKey: string

    constructor(
        private dockerApi: DockerApi,
        private certbotManager: CertbotManager,
        private dataStore: DataStore
    ) {
        this.reloadInProcess = false
        this.requestedReloadPromises = []
        this.captainPublicRandomKey = uuid()
    }

    /**
     * Reloads the configuation for NGINX.
     * @returns {Promise.<>}
     */
    rePopulateNginxConfigFile() {
        const self = this

        return new Promise<void>(function (res, rej) {
            self.requestedReloadPromises.push({
                resolveFunc: res,
                rejectFunc: rej,
            })
            self.consumeQueueIfAnyInNginxReloadQueue()
        })
    }

    consumeQueueIfAnyInNginxReloadQueue() {
        const self = this

        if (self.reloadInProcess) {
            Logger.d('NGINX Reload already in process, Bouncing off...')
            return
        }

        const q = self.requestedReloadPromises.pop()

        if (!q) {
            return
        }

        Logger.d('Locking NGINX configuration reloading...')

        self.reloadInProcess = true

        // This will resolve to something like: /captain/nginx/conf.d/captain
        const configFilePathBase = `${
            CaptainConstants.perAppNginxConfigPathBase
        }/${self.dataStore.getNameSpace()}`

        const FUTURE = configFilePathBase + '.fut'
        const BACKUP = configFilePathBase + '.bak'
        const CONFIG = configFilePathBase + '.conf'

        let nginxConfigContent = ''

        return Promise.resolve()
            .then(function () {
                return fs.remove(FUTURE)
            })
            .then(function () {
                return self.getServerList()
            })
            .then(function (servers) {
                const promises: Promise<void>[] = []

                if (servers && !!servers.length) {
                    for (let i = 0; i < servers.length; i++) {
                        const s = servers[i]
                        if (s.hasSsl) {
                            s.crtPath = self.getSslCertPath(s.publicDomain)
                            s.keyPath = self.getSslKeyPath(s.publicDomain)
                        }

                        s.staticWebRoot = `${
                            CaptainConstants.nginxStaticRootDir +
                            CaptainConstants.nginxDomainSpecificHtmlDir
                        }/${s.publicDomain}`

                        s.customErrorPagesDirectory =
                            CaptainConstants.nginxStaticRootDir +
                            CaptainConstants.nginxDefaultHtmlDir

                        const pathOfAuthInHost = `${configFilePathBase}-${s.publicDomain}.auth`

                        promises.push(
                            Promise.resolve()
                                .then(function () {
                                    if (s.httpBasicAuth) {
                                        s.httpBasicAuthPath = path.join(
                                            CONTAINER_PATH_OF_CONFIG,
                                            path.basename(pathOfAuthInHost)
                                        )
                                        return fs.outputFile(
                                            pathOfAuthInHost,
                                            s.httpBasicAuth
                                        )
                                    }
                                })
                                .then(function () {
                                    return ejs.render(s.nginxConfigTemplate, {
                                        s: s,
                                    })
                                })
                                .then(function (rendered) {
                                    nginxConfigContent += rendered
                                })
                        )
                    }
                }

                return Promise.all(promises)
            })
            .then(function () {
                return fs.outputFile(FUTURE, nginxConfigContent)
            })
            .then(function () {
                return fs.remove(BACKUP)
            })
            .then(function () {
                return fs.ensureFile(CONFIG)
            })
            .then(function () {
                return fs.renameSync(CONFIG, BACKUP) // sync method. It's really fast.
            })
            .then(function () {
                return fs.renameSync(FUTURE, CONFIG) // sync method. It's really fast.
            })
            .then(function () {
                return self.ensureBaseNginxConf()
            })
            .then(function () {
                return self.createRootConfFile()
            })
            .then(function () {
                return self.validateNginxConfigAndReload()
            })
            .then(function () {
                Logger.d('SUCCESS: UNLocking NGINX configuration reloading...')
                self.reloadInProcess = false
                q.resolveFunc()
                self.consumeQueueIfAnyInNginxReloadQueue()
            })
            .catch(function (error: AnyError) {
                Logger.e(error)
                Logger.d('Error: UNLocking NGINX configuration reloading...')
                self.reloadInProcess = false
                q.rejectFunc(error)
                self.consumeQueueIfAnyInNginxReloadQueue()
            })
    }

    validateNginxConfigAndReload() {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.dockerApi.executeCommand(
                    CaptainConstants.nginxServiceName,
                    ['nginx', '-t']
                )
            })
            .then(function (result) {
                // nginx:1.24
                // Failed example:
                //
                // 2024/08/11 22:32:59 [emerg] 28#28: unknown directive "eventsxxx" in /etc/nginx/nginx.conf:8
                // nginx: [emerg] unknown directive "eventsxxx" in /etc/nginx/nginx.conf:8
                // nginx: configuration file /etc/nginx/nginx.conf test failed

                // Successful example:
                //
                // nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
                // nginx: configuration file /etc/nginx/nginx.conf test is successful

                if (result.indexOf('test is successful') < 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_NGINX_VALIDATION_FAILED,
                        result
                    )
                }
            })
            .then(function () {
                Logger.d('sendReloadSignal...')
                return self.dockerApi.sendSingleContainerKillHUP(
                    CaptainConstants.nginxServiceName
                )
            })
    }

    getServerList() {
        const self = this

        const dataStore = self.dataStore

        let hasRootSsl: boolean
        let rootDomain: string

        return Promise.resolve()
            .then(function () {
                return dataStore.getHasRootSsl()
            })
            .then(function (val: boolean) {
                hasRootSsl = val

                return dataStore.getRootDomain()
            })
            .then(function (val) {
                rootDomain = val
            })
            .then(function () {
                return dataStore.getDefaultAppNginxConfig()
            })
            .then(function (defaultAppNginxConfig) {
                return self.getAppsServerConfig(
                    dataStore,
                    defaultAppNginxConfig,
                    hasRootSsl,
                    rootDomain
                )
            })
    }

    getAppsServerConfig(
        dataStore: DataStore,
        defaultAppNginxConfig: string,
        hasRootSsl: boolean,
        rootDomain: string
    ) {
        const servers: IServerBlockDetails[] = []
        const self = this
        let apps: IAllAppDefinitions

        return dataStore
            .getAppsDataStore()
            .getAppDefinitions()
            .then(function (loadedApps) {
                apps = loadedApps
            })
            .then(function () {
                return dataStore.getGoAccessInfo()
            })
            .then(function (goAccessInfo) {
                const logAccess = goAccessInfo.isEnabled

                Object.keys(apps).forEach(function (appName) {
                    const webApp = apps[appName]
                    const httpBasicAuth =
                        webApp.httpAuth && webApp.httpAuth.passwordHashed //
                            ? `${webApp.httpAuth.user}:${webApp.httpAuth.passwordHashed}`
                            : ''

                    if (webApp.notExposeAsWebApp) {
                        return
                    }

                    const localDomain = dataStore
                        .getAppsDataStore()
                        .getServiceName(appName)
                    const forceSsl = !!webApp.forceSsl
                    const websocketSupport = !!webApp.websocketSupport
                    const nginxConfigTemplate =
                        webApp.customNginxConfig || defaultAppNginxConfig

                    const serverWithSubDomain = {} as IServerBlockDetails
                    serverWithSubDomain.hasSsl =
                        hasRootSsl && webApp.hasDefaultSubDomainSsl
                    serverWithSubDomain.publicDomain = `${appName}.${rootDomain}`
                    serverWithSubDomain.localDomain = localDomain
                    serverWithSubDomain.forceSsl = forceSsl
                    serverWithSubDomain.websocketSupport = websocketSupport
                    const httpPort = webApp.containerHttpPort || 80
                    serverWithSubDomain.containerHttpPort = httpPort
                    serverWithSubDomain.nginxConfigTemplate =
                        nginxConfigTemplate
                    serverWithSubDomain.httpBasicAuth = httpBasicAuth
                    serverWithSubDomain.logAccessPath = logAccess
                        ? self.getLogPath(
                              appName,
                              serverWithSubDomain.publicDomain
                          )
                        : undefined

                    if (
                        webApp.redirectDomain &&
                        serverWithSubDomain.publicDomain !==
                            webApp.redirectDomain
                    ) {
                        serverWithSubDomain.redirectToPath = `http://${webApp.redirectDomain}`
                    }

                    servers.push(serverWithSubDomain)

                    // adding custom domains
                    const customDomainArray = webApp.customDomain
                    if (customDomainArray && customDomainArray.length > 0) {
                        for (
                            let idx = 0;
                            idx < customDomainArray.length;
                            idx++
                        ) {
                            const d = customDomainArray[idx]
                            const newServerBlock: IServerBlockDetails = {
                                containerHttpPort: httpPort,
                                hasSsl: d.hasSsl,
                                forceSsl: forceSsl,
                                websocketSupport: websocketSupport,
                                publicDomain: d.publicDomain,
                                localDomain: localDomain,
                                nginxConfigTemplate: nginxConfigTemplate,
                                staticWebRoot: '',
                                customErrorPagesDirectory: '',
                                httpBasicAuth: httpBasicAuth,
                                logAccessPath: logAccess
                                    ? self.getLogPath(appName, d.publicDomain)
                                    : undefined,
                            }
                            if (
                                webApp.redirectDomain &&
                                newServerBlock.publicDomain !==
                                    webApp.redirectDomain
                            ) {
                                newServerBlock.redirectToPath = `http://${webApp.redirectDomain}`
                            }
                            servers.push(newServerBlock)
                        }
                    }
                })

                return servers
            })
    }

    getCaptainPublicRandomKey() {
        return this.captainPublicRandomKey
    }

    getSslCertPath(domainName: string) {
        const self = this
        return (
            CaptainConstants.letsEncryptEtcPathOnNginx +
            self.certbotManager.getCertRelativePathForDomain(domainName)
        )
    }

    getSslKeyPath(domainName: string) {
        const self = this
        return (
            CaptainConstants.letsEncryptEtcPathOnNginx +
            self.certbotManager.getKeyRelativePathForDomain(domainName)
        )
    }

    getLogPath(appName: string, domainName: string) {
        return `${CaptainConstants.nginxSharedLogsPath}/${this.getLogName(appName, domainName)}`
    }

    getLogName(appName: string, domainName: string) {
        return `${appName}--${domainName}--access.log`
    }

    // Parses out the app and domain name from the log path original constructed in getLogPath
    // then updated when processing the logs into file names that have timestamps that look like
    // appname--some-alias.localhost--access.log--2024-10-30T01:50.html
    // or appname--speed4.captain.localhost--access.log--Current.html
    parseLogPath(logPath: string): { domainName: string; fileName: string } {
        const splitName = logPath.split('--')
        const fileName =
            splitName.length > 3
                ? `${splitName[3].replace('.html', '')}`
                : logPath

        return {
            domainName: splitName[1],
            fileName,
        }
    }

    getInfo() {
        return new Promise<LoadBalancerInfo>(function (resolve, reject) {
            const url = `http://${CaptainConstants.nginxServiceName}/nginx_status`

            request(url, function (error, response, body) {
                if (error || !body) {
                    Logger.e(`Error        ${error}`)
                    reject(
                        ApiStatusCodes.createError(
                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                            'Request to nginx Failed.'
                        )
                    )
                    return
                }

                try {
                    const data = new LoadBalancerInfo()
                    const lines = body.split('\n')

                    data.activeConnections = Number(
                        lines[0].split(' ')[2].trim()
                    )

                    data.accepted = Number(lines[2].split(' ')[1].trim())
                    data.handled = Number(lines[2].split(' ')[2].trim())
                    data.total = Number(lines[2].split(' ')[3].trim())

                    data.reading = Number(lines[3].split(' ')[1].trim())
                    data.writing = Number(lines[3].split(' ')[3].trim())
                    data.waiting = Number(lines[3].split(' ')[5].trim())

                    resolve(data)
                } catch (error) {
                    Logger.e(error)
                    reject(
                        ApiStatusCodes.createError(
                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                            'Parser Failed. See internal logs...'
                        )
                    )
                }
            })
        })
    }

    createRootConfFile() {
        const self = this
        const dataStore = self.dataStore

        const captainDomain = `${
            CaptainConstants.configs.captainSubDomain
        }.${dataStore.getRootDomain()}`
        const registryDomain = `${
            CaptainConstants.registrySubDomain
        }.${dataStore.getRootDomain()}`
        let logAccess = false

        let hasRootSsl = false

        const FUTURE = CaptainConstants.rootNginxConfigPath + '.fut'
        const BACKUP = CaptainConstants.rootNginxConfigPath + '.bak'
        const CONFIG = CaptainConstants.rootNginxConfigPath + '.conf'

        let rootNginxTemplate: string | undefined = undefined

        return Promise.resolve()
            .then(function () {
                return dataStore.getGoAccessInfo()
            })
            .then(function (goAccessInfo) {
                logAccess = goAccessInfo.isEnabled
                return dataStore.getNginxConfig()
            })
            .then(function (nginxConfig) {
                rootNginxTemplate =
                    nginxConfig.captainConfig.customValue ||
                    nginxConfig.captainConfig.byDefault

                return dataStore.getHasRootSsl()
            })
            .then(function (hasSsl) {
                hasRootSsl = hasSsl
                return dataStore.getHasRegistrySsl()
            })
            .then(function (hasRegistrySsl) {
                return ejs.render(rootNginxTemplate!, {
                    fake: {
                        crtPath: path.join(
                            NGINX_CONTAINER_PATH_OF_FAKE_CERTS,
                            'nginx.crt'
                        ),
                        keyPath: path.join(
                            NGINX_CONTAINER_PATH_OF_FAKE_CERTS,
                            'nginx.key'
                        ),
                    },
                    captain: {
                        crtPath: self.getSslCertPath(captainDomain),
                        keyPath: self.getSslKeyPath(captainDomain),
                        hasRootSsl: hasRootSsl,
                        serviceName: CaptainConstants.captainServiceName,
                        domain: captainDomain,
                        serviceExposedPort:
                            CaptainConstants.configs.adminPortNumber3000,
                        defaultHtmlDir:
                            CaptainConstants.nginxStaticRootDir +
                            CaptainConstants.nginxDefaultHtmlDir,
                        staticWebRoot: `${
                            CaptainConstants.nginxStaticRootDir +
                            CaptainConstants.nginxDomainSpecificHtmlDir
                        }/${captainDomain}`,
                        logAccessPath: logAccess
                            ? CaptainConstants.nginxSharedLogsPath
                            : undefined,
                    },
                    registry: {
                        crtPath: self.getSslCertPath(registryDomain),
                        keyPath: self.getSslKeyPath(registryDomain),
                        hasRootSsl: hasRegistrySsl,
                        domain: registryDomain,
                        staticWebRoot: `${
                            CaptainConstants.nginxStaticRootDir +
                            CaptainConstants.nginxDomainSpecificHtmlDir
                        }/${registryDomain}`,
                    },
                })
            })
            .then(function (rootNginxConfContent) {
                return fs.outputFile(FUTURE, rootNginxConfContent)
            })
            .then(function () {
                return fs.remove(BACKUP)
            })
            .then(function () {
                return fs.ensureFile(CONFIG)
            })
            .then(function () {
                return fs.renameSync(CONFIG, BACKUP) // sync method. It's really fast.
            })
            .then(function () {
                return fs.renameSync(FUTURE, CONFIG) // sync method. It's really fast.
            })
    }

    ensureBaseNginxConf() {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.dataStore.getNginxConfig()
            })
            .then(function (captainConfig) {
                const baseConfigTemplate =
                    captainConfig.baseConfig.customValue ||
                    captainConfig.baseConfig.byDefault

                return ejs.render(baseConfigTemplate, {
                    base: {
                        dhparamsFilePath:
                            fs.existsSync(DH_PARAMS_FILE_PATH_ON_HOST) &&
                            fs
                                .readFileSync(DH_PARAMS_FILE_PATH_ON_HOST)
                                .toString().length > 10 // making sure it's not an buggy file
                                ? DH_PARAMS_FILE_PATH_ON_NGINX
                                : '',
                    },
                })
            })
            .then(function (baseNginxConfFileContent) {
                return fs.outputFile(
                    CaptainConstants.baseNginxConfigPath,
                    baseNginxConfFileContent
                )
            })
    }

    ensureDhParamFileExists() {
        const self = this
        return fs
            .pathExists(DH_PARAMS_FILE_PATH_ON_HOST) //
            .then(function (dhParamExists) {
                if (!dhParamExists) {
                    return false
                }

                const dhFileContent = fs
                    .readFileSync(DH_PARAMS_FILE_PATH_ON_HOST)
                    .toString()

                const contentValid =
                    dhFileContent.indexOf('END DH PARAMETERS') > 0

                if (contentValid) {
                    return true
                }

                Logger.d(
                    `Invalid dh param content - size of: ${dhFileContent.length}`
                )
                fs.removeSync(DH_PARAMS_FILE_PATH_ON_HOST)

                return false
            })
            .then(function (dhParamExists) {
                if (dhParamExists) {
                    return
                }

                Logger.d(
                    'Creating dhparams for the first time - high CPU load is expected.'
                )
                return exec(
                    `openssl dhparam -out ${DH_PARAMS_FILE_PATH_ON_HOST} 2048`
                ).then(function () {
                    Logger.d('Updating Load Balancer - ensureDhParamFileExists')
                    return self.rePopulateNginxConfigFile()
                })
            })
            .catch((err) => Logger.e(err))
    }

    init(myNodeId: string, dataStore: DataStore) {
        const dockerApi = this.dockerApi
        const self = this

        function createNginxServiceOnNode(nodeId: string) {
            Logger.d(
                'No Captain Nginx service is running. Creating one on captain node...'
            )

            return dockerApi
                .createServiceOnNodeId(
                    CaptainConstants.configs.nginxImageName,
                    CaptainConstants.nginxServiceName,
                    [
                        {
                            protocol: 'tcp',
                            publishMode: 'host',
                            containerPort: 80,
                            hostPort:
                                CaptainConstants.configs.nginxPortNumber80,
                        },
                        {
                            protocol: 'tcp',
                            publishMode: 'host',
                            containerPort: 443,
                            hostPort:
                                CaptainConstants.configs.nginxPortNumber443,
                        },
                        {
                            protocol: 'udp',
                            publishMode: 'host',
                            containerPort: 443,
                            hostPort:
                                CaptainConstants.configs.nginxPortNumber443,
                        },
                    ],
                    nodeId,
                    undefined,
                    undefined,
                    {
                        Reservation: {
                            MemoryBytes: 30 * 1024 * 1024,
                        },
                    }
                )
                .then(function () {
                    const waitTimeInMillis = 5000
                    Logger.d(
                        `Waiting for ${
                            waitTimeInMillis / 1000
                        } seconds for nginx to start up`
                    )
                    return new Promise<boolean>(function (resolve, reject) {
                        setTimeout(function () {
                            resolve(true)
                        }, waitTimeInMillis)
                    })
                })
        }

        return fs
            .outputFile(
                CaptainConstants.captainStaticFilesDir +
                    CaptainConstants.nginxDefaultHtmlDir +
                    CaptainConstants.captainConfirmationPath,
                self.getCaptainPublicRandomKey()
            )
            .then(function () {
                return ejs.render(defaultPageTemplate, {
                    message_title: 'Nothing here yet :/',
                    message_body: '',
                    message_link: 'https://caprover.com/',
                    message_link_title: 'Read Docs',
                })
            })
            .then(function (staticPageContent) {
                return fs.outputFile(
                    CaptainConstants.captainStaticFilesDir +
                        CaptainConstants.nginxDefaultHtmlDir +
                        '/index.html',
                    staticPageContent
                )
            })
            .then(function () {
                return ejs.render(defaultPageTemplate, {
                    message_title: 'An Error Occurred :/',
                    message_body: '',
                    message_link: 'https://caprover.com/',
                    message_link_title: 'Read Docs',
                })
            })
            .then(function (errorGenericPageContent) {
                return fs.outputFile(
                    CaptainConstants.captainStaticFilesDir +
                        CaptainConstants.nginxDefaultHtmlDir +
                        '/error_generic_catch_all.html',
                    errorGenericPageContent
                )
            })
            .then(function () {
                return ejs.render(defaultPageTemplate, {
                    message_title: 'NGINX 502 Error :/',
                    message_body:
                        "If you are the developer, check your application's logs. See the link below for details",
                    message_link:
                        'https://caprover.com/docs/troubleshooting.html#successful-deploy-but-502-bad-gateway-error',
                    message_link_title: 'Docs - 502 Troubleshooting',
                })
            })
            .then(function (error502PageContent) {
                return fs.outputFile(
                    CaptainConstants.captainStaticFilesDir +
                        CaptainConstants.nginxDefaultHtmlDir +
                        '/captain_502_custom_error_page.html',
                    error502PageContent
                )
            })
            .then(function () {
                Logger.d('Copying fake certificates...')

                return fs.copy(
                    CAPROVER_CONTAINER_PATH_OF_FAKE_CERTS,
                    HOST_PATH_OF_FAKE_CERTS
                )
            })
            .then(function () {
                return fs.ensureDir(CaptainConstants.letsEncryptEtcPath)
            })
            .then(function () {
                return fs.ensureDir(CaptainConstants.nginxSharedPathOnHost)
            })
            .then(function () {
                return dockerApi.isServiceRunningByName(
                    CaptainConstants.nginxServiceName
                )
            })
            .then(function (isRunning) {
                if (isRunning) {
                    Logger.d('Captain Nginx is already running.. ')

                    return dockerApi.getNodeIdByServiceName(
                        CaptainConstants.nginxServiceName,
                        0
                    )
                } else {
                  Logger.d('Captain Nginx is NOT running.. ')
                    return createNginxServiceOnNode(myNodeId).then(function () {
                        return myNodeId
                    })
                }
            })
            .then(function (nodeId) {
                if (nodeId !== myNodeId) {
                    Logger.d(
                        'Captain Nginx is running on a different node. Removing...'
                    )

                    return dockerApi
                        .removeServiceByName(CaptainConstants.nginxServiceName)
                        .then(function () {
                            return createNginxServiceOnNode(myNodeId).then(
                                function () {
                                    return true
                                }
                            )
                        })
                } else {
                    return true
                }
            })
            .then(function () {
                Logger.d(
                    'Updating Load Balancer - Setting up NGINX conf file...'
                )
                return self.rePopulateNginxConfigFile()
            })
            .then(function () {
                Logger.d('Updating NGINX service...')

                return dockerApi.updateService(
                    CaptainConstants.nginxServiceName,
                    CaptainConstants.configs.nginxImageName,
                    [
                        {
                            containerPath: CaptainConstants.nginxStaticRootDir,
                            hostPath: CaptainConstants.captainStaticFilesDir,
                        },
                        {
                            containerPath: NGINX_CONTAINER_PATH_OF_FAKE_CERTS,
                            hostPath: HOST_PATH_OF_FAKE_CERTS,
                        },
                        {
                            containerPath: '/etc/nginx/nginx.conf',
                            hostPath: CaptainConstants.baseNginxConfigPath,
                        },
                        {
                            containerPath: CONTAINER_PATH_OF_CONFIG,
                            hostPath:
                                CaptainConstants.perAppNginxConfigPathBase,
                        },
                        {
                            containerPath:
                                CaptainConstants.letsEncryptEtcPathOnNginx,
                            hostPath: CaptainConstants.letsEncryptEtcPath,
                        },
                        {
                            containerPath:
                                CaptainConstants.nginxSharedPathOnNginx,
                            hostPath: CaptainConstants.nginxSharedPathOnHost,
                        },
                        {
                            hostPath:
                                CaptainConstants.nginxSharedLogsPathOnHost,
                            containerPath: CaptainConstants.nginxSharedLogsPath,
                        },
                    ],
                    [CaptainConstants.captainNetworkName],
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    undefined
                )
            })
            .then(function () {
                const waitTimeInMillis = 5000
                Logger.d(
                    `Waiting for ${
                        waitTimeInMillis / 1000
                    } seconds for nginx reload to take into effect`
                )
                return new Promise<boolean>(function (resolve, reject) {
                    setTimeout(function () {
                        Logger.d('NGINX is fully set up and working...')
                        resolve(true)
                    }, waitTimeInMillis)
                })
            })
            .then(function () {
                return self.certbotManager.init(myNodeId)
            })
            .then(function () {
                // schedule the 10sec:
                // Ensure DH Params exists
                // First attempt to renew certs in
                setTimeout(function () {
                    self.ensureDhParamFileExists() //
                        .then(function () {
                            return self.renewAllCertsAndReload()
                        })
                        .catch((err) => {
                            Logger.e(err)
                        })
                }, 1000 * 10)
            })
    }

    renewAllCertsAndReload() {
        const self = this

        // before doing renewal, let's schedule the next one in 20.3 hours!
        // this random schedule helps to avoid retrying at the same time of
        // the day in case if that's our super high traffic time

        setTimeout(
            function () {
                self.renewAllCertsAndReload() //
                    .catch((err) => {
                        Logger.e(err)
                    })
            },
            1000 * 3600 * 20.3
        )

        return self.certbotManager
            .renewAllCerts() //
            .then(function () {
                Logger.d('Updating Load Balancer - renewAllCerts')
                return self.rePopulateNginxConfigFile()
            })
    }
}

export default LoadBalancerManager
