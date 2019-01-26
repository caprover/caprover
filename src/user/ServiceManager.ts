import Logger = require('../utils/Logger')
import CaptainConstants = require('../utils/CaptainConstants')
import CaptainManager = require('./system/CaptainManager')
import LoadBalancerManager = require('./system/LoadBalancerManager')
import DockerApi, { IDockerUpdateOrders } from '../docker/DockerApi'
import DataStore = require('../datastore/DataStore')
import ApiStatusCodes = require('../api/ApiStatusCodes')
import requireFromString = require('require-from-string')
import BuildLog = require('./BuildLog')
import { ImageInfo } from 'dockerode'
import DockerRegistryHelper = require('./DockerRegistryHelper')
import ImageMaker from './ImageMaker'

class ServiceManager {
    private activeBuilds: IHashMapGeneric<boolean>
    private buildLogs: IHashMapGeneric<BuildLog>
    private isReady: boolean
    private imageMaker: ImageMaker
    private dockerRegistryHelper: DockerRegistryHelper

    constructor(
        private dataStore: DataStore,
        private dockerApi: DockerApi,
        private loadBalancerManager: LoadBalancerManager
    ) {
        this.activeBuilds = {}
        this.buildLogs = {}
        this.isReady = true
        this.dockerRegistryHelper = new DockerRegistryHelper(
            this.dataStore,
            this.dockerApi
        )
        this.imageMaker = new ImageMaker(
            this.dockerRegistryHelper,
            this.dockerApi,
            this.dataStore.getNameSpace(),
            this.buildLogs,
            this.activeBuilds
        )
    }

    getRegistryHelper() {
        return this.dockerRegistryHelper
    }

    isInited() {
        return this.isReady
    }

    deployNewVersion(appName: string, source: IImageSource) {
        const self = this
        const dataStore = this.dataStore
        let deployedVersion: number
        return Promise.resolve() //
            .then(function() {
                return dataStore.getAppsDataStore().createNewVersion(appName)
            })
            .then(function(appVersion) {
                deployedVersion = appVersion
                return self.imageMaker.ensureImage(source, appName, appVersion)
            })
            .then(function(builtImage) {
                return dataStore
                    .getAppsDataStore()
                    .setDeployedVersionAndImage(
                        appName,
                        deployedVersion,
                        builtImage
                    )
            })
            .then(function() {
                return self.ensureServiceInitedAndUpdated(appName)
            })
            .catch(function(error) {
                return new Promise<void>(function(resolve, reject) {
                    self.logBuildFailed(appName, error)
                    reject(error)
                })
            })
    }

    enableCustomDomainSsl(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                Logger.d('Verifying Captain owns domain: ' + customDomain)

                return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(
                    customDomain,
                    undefined
                )
            })
            .then(function() {
                Logger.d('Enabling SSL for: ' + appName + ' on ' + customDomain)

                return self.dataStore
                    .getAppsDataStore()
                    .verifyCustomDomainBelongsToApp(appName, customDomain)
            })
            .then(function() {
                return CaptainManager.get().requestCertificateForDomain(
                    customDomain
                )
            })
            .then(function() {
                return self.dataStore
                    .getAppsDataStore()
                    .enableCustomDomainSsl(appName, customDomain)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    addCustomDomain(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                const rootDomain = self.dataStore.getRootDomain()
                const dotRootDomain = '.' + rootDomain

                if (!customDomain || !/^[a-z0-9\-\.]+$/.test(customDomain)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca'
                    )
                }

                if (customDomain.length > 80) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Please use alphanumerical domains less than 80 characters in length.'
                    )
                }

                if (customDomain.indexOf('..') >= 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. You cannot have two consecutive periods ".." inside a domain name. Please use alphanumerical domains such as myapp.google123.ca'
                    )
                }

                if (
                    customDomain.indexOf(dotRootDomain) >= 0 &&
                    customDomain.indexOf(dotRootDomain) +
                        dotRootDomain.length ===
                        customDomain.length
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_BAD_NAME,
                        'Domain name is not accepted. Custom domain cannot be subdomain of root domain.'
                    )
                }
            })
            .then(function() {
                return CaptainManager.get().verifyDomainResolvesToDefaultServerOnHost(
                    customDomain
                )
            })
            .then(function() {
                Logger.d('Enabling custom domain for: ' + appName)

                return self.dataStore
                    .getAppsDataStore()
                    .addCustomDomainForApp(appName, customDomain)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    removeCustomDomain(appName: string, customDomain: string) {
        const self = this

        return Promise.resolve()
            .then(function() {
                Logger.d('Removing custom domain for: ' + appName)

                return self.dataStore
                    .getAppsDataStore()
                    .removeCustomDomainForApp(appName, customDomain)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    enableSslForApp(appName: string) {
        const self = this

        let rootDomain: string

        return Promise.resolve()
            .then(function() {
                return self.verifyCaptainOwnsGenericSubDomain(appName)
            })
            .then(function() {
                Logger.d('Enabling SSL for: ' + appName)

                return self.dataStore.getRootDomain()
            })
            .then(function(val) {
                rootDomain = val

                if (!rootDomain) {
                    throw new Error('No rootDomain! Cannot verify domain')
                }
            })
            .then(function() {
                // it will ensure that the app exists, otherwise it throws an exception
                return self.dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
            })
            .then(function() {
                return appName + '.' + rootDomain
            })
            .then(function(domainName) {
                return CaptainManager.get().requestCertificateForDomain(
                    domainName
                )
            })
            .then(function() {
                return self.dataStore
                    .getAppsDataStore()
                    .enableSslForDefaultSubDomain(appName)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    verifyCaptainOwnsGenericSubDomain(appName: string) {
        const self = this

        let rootDomain: string

        return Promise.resolve()
            .then(function() {
                return self.dataStore.getRootDomain()
            })
            .then(function(val) {
                rootDomain = val
            })
            .then(function() {
                // it will ensure that the app exists, otherwise it throws an exception
                return self.dataStore
                    .getAppsDataStore()
                    .getAppDefinition(appName)
            })
            .then(function() {
                return appName + '.' + rootDomain
            })
            .then(function(domainName) {
                Logger.d('Verifying Captain owns domain: ' + domainName)

                return CaptainManager.get().verifyCaptainOwnsDomainOrThrow(
                    domainName,
                    undefined
                )
            })
    }

    removeApp(appName: string) {
        Logger.d('Removing service for: ' + appName)
        const self = this

        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore

        return Promise.resolve()
            .then(function() {
                Logger.d('Check if service is running: ' + serviceName)
                return dockerApi.isServiceRunningByName(serviceName)
            })
            .then(function(isRunning) {
                if (isRunning) {
                    return dockerApi.removeServiceByName(serviceName)
                } else {
                    Logger.w(
                        'Cannot delete service... It is not running: ' +
                            serviceName
                    )
                    return true
                }
            })
            .then(function() {
                return dataStore.getAppsDataStore().deleteAppDefinition(appName)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    getUnusedImages(mostRecentLimit: number) {
        Logger.d(
            'Getting unused images, excluding most recent ones: ' +
                mostRecentLimit
        )
        const self = this

        const dockerApi = this.dockerApi
        const dataStore = this.dataStore
        let allImages: ImageInfo[]

        return Promise.resolve()
            .then(function() {
                return dockerApi.getImages()
            })
            .then(function(images) {
                allImages = images

                return dataStore.getAppsDataStore().getAppDefinitions()
            })
            .then(function(apps) {
                const unusedImages = []

                if (mostRecentLimit < 0) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'Most Recent Limit cannot be negative'
                    )
                }

                for (let i = 0; i < allImages.length; i++) {
                    const img = allImages[i]
                    let imageInUse = false

                    const repoTags = img.RepoTags || []

                    Object.keys(apps).forEach(function(key, index) {
                        const app = apps[key]
                        const appName = key
                        for (let k = 0; k < mostRecentLimit + 1; k++) {
                            const versionToCheck =
                                Number(app.deployedVersion) - k

                            if (versionToCheck < 0) continue

                            let deployedImage = ''
                            app.versions.forEach(v => {
                                if (v.version === versionToCheck) {
                                    deployedImage = v.deployedImageName || ''
                                }
                            })

                            if (!deployedImage) continue

                            if (repoTags.indexOf(deployedImage) >= 0) {
                                imageInUse = true
                            }
                        }
                    })

                    if (!imageInUse) {
                        unusedImages.push({
                            id: img.Id,
                            tags: repoTags,
                        })
                    }
                }

                return unusedImages
            })
    }

    deleteImages(imageIds: string[]) {
        Logger.d('Deleting images...')
        const self = this

        const dockerApi = this.dockerApi

        return Promise.resolve().then(function() {
            return dockerApi.deleteImages(imageIds)
        })
    }

    createPreDeployFunctionIfExist(app: IAppDef): Function | undefined {
        let preDeployFunction = app.preDeployFunction

        if (!preDeployFunction) {
            return undefined
        }

        /*
        ////////////////////////////////// Expected content of the file //////////////////////////

            const uuid = require('uuid/v4');
            console.log('-------------------------------'+uuid());

            preDeployFunction = function (captainAppObj, dockerUpdateObject) {
                return Promise.resolve()
                        .then(function(){
                            console.log(JSON.stringify(dockerUpdateObject));
                            return dockerUpdateObject;
                        });
            };
         */

        preDeployFunction =
            preDeployFunction + '\n\n module.exports = preDeployFunction'

        return requireFromString(preDeployFunction)
    }

    updateAppDefinition(
        appName: string,
        instanceCount: number,
        envVars: IAppEnvVar[],
        volumes: IAppVolume[],
        nodeId: string,
        notExposeAsWebApp: boolean,
        containerHttpPort: number,
        forceSsl: boolean,
        ports: IAppPort[],
        repoInfo: RepoInfo,
        customNginxConfig: string,
        preDeployFunction: string
    ) {
        const self = this
        const dataStore = this.dataStore
        const dockerApi = this.dockerApi

        let serviceName: string

        const checkIfNodeIdExists = function(nodeIdToCheck: string) {
            return dockerApi.getNodesInfo().then(function(nodeInfo) {
                for (let i = 0; i < nodeInfo.length; i++) {
                    if (nodeIdToCheck === nodeInfo[i].nodeId) {
                        return
                    }
                }

                throw ApiStatusCodes.createError(
                    ApiStatusCodes.STATUS_ERROR_GENERIC,
                    'Node ID you requested in not part of the swarm ' +
                        nodeIdToCheck
                )
            })
        }

        return Promise.resolve()
            .then(function() {
                return dataStore.getAppsDataStore().getAppDefinition(appName)
            })
            .then(function(app) {
                serviceName = dataStore
                    .getAppsDataStore()
                    .getServiceName(appName)

                // After leaving this block, nodeId will be guaranteed to be NonNull
                if (app.hasPersistentData) {
                    if (nodeId) {
                        return checkIfNodeIdExists(nodeId)
                    } else {
                        if (app.nodeId) {
                            nodeId = app.nodeId
                        } else {
                            return dockerApi
                                .isServiceRunningByName(serviceName)
                                .then(function(isRunning: boolean) {
                                    if (!isRunning) {
                                        throw ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'Cannot find the service. Try again in a minute...'
                                        )
                                    }
                                    return dockerApi.getNodeIdByServiceName(
                                        serviceName,
                                        0
                                    )
                                })
                                .then(function(nodeIdRunningService: string) {
                                    if (!nodeIdRunningService) {
                                        throw ApiStatusCodes.createError(
                                            ApiStatusCodes.STATUS_ERROR_GENERIC,
                                            'No NodeId was found. Try again in a minute...'
                                        )
                                    }

                                    nodeId = nodeIdRunningService
                                })
                        }
                    }
                } else {
                    if (volumes && volumes.length) {
                        throw ApiStatusCodes.createError(
                            ApiStatusCodes.ILLEGAL_OPERATION,
                            'Cannot set volumes for a non-persistent container!'
                        )
                    }

                    if (nodeId) {
                        return checkIfNodeIdExists(nodeId)
                    }
                }
            })
            .then(function() {
                return dataStore
                    .getAppsDataStore()
                    .updateAppDefinitionInDb(
                        appName,
                        instanceCount,
                        envVars,
                        volumes,
                        nodeId,
                        notExposeAsWebApp,
                        containerHttpPort,
                        forceSsl,
                        ports,
                        repoInfo,
                        CaptainManager.getAuthenticator(
                            dataStore.getNameSpace()
                        ),
                        customNginxConfig,
                        preDeployFunction
                    )
            })
            .then(function() {
                return self.ensureServiceInitedAndUpdated(appName)
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    isAppBuilding(appName: string) {
        return !!this.activeBuilds[appName]
    }

    /**
     *
     * @returns the active build that it finds
     */
    isAnyBuildRunning() {
        const activeBuilds = this.activeBuilds

        for (const appName in activeBuilds) {
            if (!!activeBuilds[appName]) {
                return appName
            }
        }

        return undefined
    }

    getBuildStatus(appName: string) {
        const self = this
        this.buildLogs[appName] =
            this.buildLogs[appName] ||
            new BuildLog(CaptainConstants.configs.buildLogSize)

        return {
            isAppBuilding: self.isAppBuilding(appName),
            logs: self.buildLogs[appName].getLogs(),
            isBuildFailed: self.buildLogs[appName].isBuildFailed,
        }
    }

    logBuildFailed(appName: string, error: string) {
        error = (error || '') + ''
        this.buildLogs[appName] =
            this.buildLogs[appName] ||
            new BuildLog(CaptainConstants.configs.buildLogSize)
        this.buildLogs[appName].onBuildFailed(error)
    }

    getAppLogs(appName: string) {
        const self = this

        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)

        const dockerApi = this.dockerApi

        return Promise.resolve() //
            .then(function() {
                return dockerApi.getLogForService(
                    serviceName,
                    CaptainConstants.configs.appLogSize
                )
            })
    }

    ensureServiceInitedAndUpdated(appName: string) {
        Logger.d('Ensure service inited and Updated for: ' + appName)
        const self = this

        const serviceName = this.dataStore
            .getAppsDataStore()
            .getServiceName(appName)

        let imageName: string | undefined
        const dockerApi = this.dockerApi
        const dataStore = this.dataStore
        let app: IAppDef
        let dockerAuthObject: DockerAuthObj | undefined

        return Promise.resolve() //
            .then(function() {
                return dataStore.getAppsDataStore().getAppDefinition(appName)
            })
            .then(function(appFound) {
                app = appFound

                Logger.d(`Check if service is running: ${serviceName}`)
                return dockerApi.isServiceRunningByName(serviceName)
            })
            .then(function(isRunning) {
                for (let i = 0; i < app.versions.length; i++) {
                    const element = app.versions[i]
                    if (element.version === app.deployedVersion) {
                        imageName = element.deployedImageName
                        break
                    }
                }

                if (!imageName) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        'ImageName for deployed version is not available, this version was probably failed due to an unsuccessful build!'
                    )
                }

                if (isRunning) {
                    Logger.d('Service is already running: ' + serviceName)
                    return true
                } else {
                    Logger.d(
                        `Creating service ${serviceName} with default image, we will update image later`
                    )

                    // if we pass in networks here. Almost always it results in a delayed update which causes
                    // update errors if they happen right away!
                    return dockerApi.createServiceOnNodeId(
                        CaptainConstants.configs.appPlaceholderImageName,
                        serviceName,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        undefined
                    )
                }
            })
            .then(function() {
                return self.dockerRegistryHelper.getDockerAuthObjectForImageName(
                    imageName!
                )
            })
            .then(function(data) {
                dockerAuthObject = data
            })
            .then(function() {
                return self.createPreDeployFunctionIfExist(app)
            })
            .then(function(preDeployFunction) {
                Logger.d(
                    `Updating service ${serviceName} with image ${imageName}`
                )

                return dockerApi.updateService(
                    serviceName,
                    imageName,
                    app.volumes,
                    app.networks,
                    app.envVars,
                    undefined,
                    dockerAuthObject,
                    Number(app.instanceCount),
                    app.nodeId,
                    dataStore.getNameSpace(),
                    app.ports,
                    app,
                    IDockerUpdateOrders.AUTO,
                    preDeployFunction
                )
            })
            .then(function() {
                return new Promise<void>(function(resolve) {
                    // Waiting 2 extra seconds for docker DNS to pickup the service name
                    setTimeout(resolve, 2000)
                })
            })
            .then(function() {
                return self.reloadLoadBalancer()
            })
    }

    reloadLoadBalancer() {
        Logger.d('Updating Load Balancer')
        const self = this
        return self.loadBalancerManager
            .rePopulateNginxConfigFile(self.dataStore)
            .then(function() {
                Logger.d('sendReloadSignal...')
                return self.loadBalancerManager.sendReloadSignal()
            })
    }
}

export = ServiceManager
