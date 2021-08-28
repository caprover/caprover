import Base64Provider = require('js-base64')
import Docker = require('dockerode')
import { v4 as uuid } from 'uuid'
import DockerService from '../models/DockerService'
import {
    IDockerApiPort,
    IDockerContainerResource,
    PreDeployFunction,
    VolumesTypes,
} from '../models/OtherTypes'
import BuildLog from '../user/BuildLog'
import CaptainConstants from '../utils/CaptainConstants'
import EnvVars from '../utils/EnvVars'
import Logger from '../utils/Logger'
import Utils from '../utils/Utils'
import Dockerode = require('dockerode')
const dockerodeUtils = require('dockerode/lib/util')

const Base64 = Base64Provider.Base64

function safeParseChunk(chunk: string): {
    stream?: string
    error?: any
    errorDetail?: any
}[] {
    chunk = `${chunk}`.trim()
    try {
        // See https://github.com/caprover/caprover/issues/570
        // This appears to be bug either in Docker or dockerone:
        // Sometimes chunk appears as two JSON objects, like
        // ```
        // {"stream":"something......"}
        // {"stream":"another line of things"}
        // ```
        const chunks = chunk.split('\n')
        const returnVal = [] as any[]
        chunks.forEach((chk) => {
            returnVal.push(JSON.parse(chk))
        })
        return returnVal
    } catch (ignore) {
        return [
            {
                stream: `Cannot parse ${chunk}`,
            },
        ]
    }
}

export abstract class IDockerUpdateOrders {
    public static readonly AUTO = 'auto'
    public static readonly STOP_FIRST = 'stopFirst'
    public static readonly START_FIRST = 'startFirst'
}
export type IDockerUpdateOrder = 'auto' | 'stopFirst' | 'startFirst'

class DockerApi {
    private dockerode: Docker

    constructor(connectionParams: Docker.DockerOptions) {
        this.dockerode = new Docker(connectionParams)
    }

    static get() {
        return dockerApiInstance
    }

    initSwarm(ip: string, portNumber?: number) {
        const self = this

        portNumber = portNumber || 2377
        const port = `${portNumber}`

        const advertiseAddr = `${ip}:${port}`

        const swarmOptions = {
            ListenAddr: `0.0.0.0:${port}`,
            AdvertiseAddr: advertiseAddr,
            ForceNewCluster: false,
        }

        Logger.d(`Starting swarm at ${advertiseAddr}`)

        return self.dockerode.swarmInit(swarmOptions)
    }

    swarmLeave(forced: boolean) {
        const self = this

        return self.dockerode.swarmLeave({
            force: !!forced,
        })
    }

    getNodeIdByServiceName(
        serviceName: string,
        retryCount: number
    ): Promise<string> {
        const self = this
        retryCount = retryCount || 0

        return self.dockerode
            .listTasks({
                filters: {
                    service: [serviceName],
                    'desired-state': ['running'],
                },
            })
            .then(function (data) {
                if (data.length > 0) {
                    return Promise.resolve(data[0].NodeID)
                } else {
                    if (retryCount < 10) {
                        return new Promise<void>(function (resolve) {
                            setTimeout(function () {
                                resolve()
                            }, 3000)
                        }).then(function () {
                            Logger.d(
                                `Retrying to get NodeID for ${serviceName} retry count:${retryCount}`
                            )

                            return self.getNodeIdByServiceName(
                                serviceName,
                                retryCount + 1
                            )
                        })
                    }

                    throw new Error(
                        `There must be only one instance (not ${data.length}) of the service running to find node id. ${serviceName}`
                    )
                }
            })
    }

    getLeaderNodeId() {
        const self = this

        return Promise.resolve()
            .then(function () {
                return self.dockerode.listNodes()
            })
            .then(function (nodes) {
                for (let idx = 0; idx < nodes.length; idx++) {
                    const node = nodes[idx]
                    if (node.ManagerStatus && node.ManagerStatus.Leader) {
                        return node.ID
                    }
                }
            })
    }

    getAllServices() {
        const self = this

        return Promise.resolve()
            .then(function () {
                return self.dockerode.listServices()
            })
            .then(function (services) {
                return (services || []) as unknown as DockerService[]
            })
    }

    createJoinCommand(
        captainIpAddress: string,
        token: string,
        workerIp: string
    ) {
        return `docker swarm join --token ${token} ${captainIpAddress}:2377 --advertise-addr ${workerIp}:2377`
    }

    getNodesInfo() {
        const self = this

        return Promise.resolve()
            .then(function () {
                return self.dockerode.listNodes()
            })
            .then(function (nodes) {
                const ret: ServerDockerInfo[] = []

                if (!nodes || !nodes.length) {
                    return ret
                }

                for (let i = 0; i < nodes.length; i++) {
                    const n = nodes[i]
                    ret.push({
                        nodeId: n.ID,
                        type: n.Spec.Role,
                        isLeader:
                            n.Spec.Role === 'manager' &&
                            n.ManagerStatus &&
                            n.ManagerStatus.Leader === true,
                        hostname: n.Description.Hostname,
                        architecture: n.Description.Platform.Architecture,
                        operatingSystem: n.Description.Platform.OS,
                        nanoCpu: n.Description.Resources.NanoCPUs,
                        memoryBytes: n.Description.Resources.MemoryBytes,
                        dockerEngineVersion: n.Description.Engine.EngineVersion,
                        ip: n.Status.Addr,
                        state: n.Status.State, // whether down or ready (this means the machine is down)
                        status: n.Spec.Availability, // whether active, drain or pause (this is the expected behavior)
                    })
                }

                return ret
            })
    }

    getJoinToken(isManager: boolean) {
        const self = this

        return Promise.resolve()
            .then(function () {
                return self.dockerode.swarmInspect()
            })
            .then(function (inspectData) {
                if (!inspectData || !inspectData.JoinTokens) {
                    throw new Error('Inspect data does not contain tokens!!')
                }

                const token = isManager
                    ? inspectData.JoinTokens.Manager
                    : inspectData.JoinTokens.Worker

                if (!token) {
                    throw new Error(
                        'Inspect data does not contain the required token!!'
                    )
                }

                return token
            })
    }

    buildImageFromDockerFile(
        imageName: string,
        newVersionNumber: number,
        tarballFilePath: string,
        buildLogs: BuildLog,
        envVars: IAppEnvVar[],
        registryConfig: DockerRegistryConfig
    ) {
        const self = this

        const newVersion = `${newVersionNumber}`

        Logger.d('Building docker image. This might take a few minutes...')

        return Promise.resolve()
            .then(function () {
                const buildargs: IHashMapGeneric<string> = {}

                envVars.forEach((env) => {
                    buildargs[env.key] = env.value
                })

                if (envVars.length > 0) {
                    buildLogs.log(
                        'Ignore warnings for unconsumed build-args if there is any'
                    )
                }

                const optionsForBuild: Dockerode.ImageBuildOptions = {
                    t: imageName,
                    buildargs: buildargs,
                }

                if (Object.keys(registryConfig).length > 0) {
                    // https://github.com/apocas/dockerode/blob/ed6ef39e0fc81963fedf208c7e0854d8a44cb9a8/lib/docker.js#L271-L274
                    // https://github.com/apocas/docker-modem/blob/master/lib/modem.js#L160-L163
                    // "X-Registry-Config" in docker API
                    optionsForBuild['registryconfig'] = registryConfig
                }

                return self.dockerode.buildImage(
                    tarballFilePath,
                    optionsForBuild
                )
            })
            .then(function (stream) {
                return new Promise<void>(function (resolve, reject) {
                    let errorMessage = ''

                    stream.setEncoding('utf8')

                    // THIS BLOCK HAS TO BE HERE. "end" EVENT WON'T GET CALLED OTHERWISE.
                    stream.on('data', function (chunkRaw) {
                        Logger.dev(`stream data ${chunkRaw}`)
                        safeParseChunk(chunkRaw).forEach((chunk) => {
                            const chuckStream = chunk.stream
                            if (chuckStream) {
                                // Logger.dev('stream data ' + chuckStream);
                                buildLogs.log(chuckStream)
                            }

                            if (chunk.error) {
                                Logger.e(chunk.error)
                                const errorDetails = JSON.stringify(
                                    chunk.errorDetail
                                )
                                Logger.e(errorDetails)
                                buildLogs.log(errorDetails)
                                buildLogs.log(chunk.error)
                                errorMessage += '\n'
                                errorMessage += errorDetails
                                errorMessage += '\n'
                                errorMessage += chunk.error
                            }
                        })
                    })

                    // stream.pipe(process.stdout, {end: true});
                    // IncomingMessage
                    // https://nodejs.org/api/stream.html#stream_event_end

                    stream.on('end', function () {
                        if (errorMessage) {
                            reject(errorMessage)
                            return
                        }
                        resolve()
                    })

                    stream.on('error', function (chunk) {
                        errorMessage += chunk
                    })
                })
            })
            .then(function () {
                return self.dockerode.getImage(imageName).tag({
                    tag: newVersion,
                    repo: imageName,
                })
            })
    }

    pullImage(
        imageNameIncludingTag: string,
        authObj: DockerAuthObj | undefined
    ) {
        const self = this

        const parsedTag = dockerodeUtils.parseRepositoryTag(
            imageNameIncludingTag
        )
        const repository = parsedTag.repository
        const tag = parsedTag.tag || 'latest'

        return Promise.resolve()
            .then(function () {
                return self.dockerode.createImage({
                    fromImage: repository,
                    tag: tag,
                    authconfig: authObj,
                })
            })
            .then(function (stream) {
                return new Promise<void>(function (resolve, reject) {
                    let errorMessage = ''
                    const logsBeforeError: string[] = []
                    for (let i = 0; i < 20; i++) {
                        logsBeforeError.push('')
                    }

                    stream.setEncoding('utf8')

                    // THIS BLOCK HAS TO BE HERE. "end" EVENT WON'T GET CALLED OTHERWISE.
                    stream.on('data', function (chunkRaw) {
                        Logger.dev(`stream data ${chunkRaw}`)
                        safeParseChunk(chunkRaw).forEach((chunk) => {
                            const chuckStream = chunk.stream
                            if (chuckStream) {
                                // Logger.dev('stream data ' + chuckStream);
                                logsBeforeError.shift()
                                logsBeforeError.push(chuckStream)
                            }

                            if (chunk.error) {
                                Logger.e(chunk.error)
                                Logger.e(JSON.stringify(chunk.errorDetail))
                                errorMessage += '\n [truncated] \n'
                                errorMessage += logsBeforeError.join('')
                                errorMessage += '\n'
                                errorMessage += chunk.error
                            }
                        })
                    })

                    // stream.pipe(process.stdout, {end: true});
                    // IncomingMessage
                    // https://nodejs.org/api/stream.html#stream_event_end

                    stream.on('end', function () {
                        if (errorMessage) {
                            reject(errorMessage)
                            return
                        }
                        resolve()
                    })

                    stream.on('error', function (chunk) {
                        errorMessage += chunk
                    })
                })
            })
    }

    /**
     * This method container a lot of hacks to workaround some Docker issues.
     * See https://github.com/githubsaturn/captainduckduck/issues/176
     *
     * @param nameOrId
     * @param networkIdOrName
     * @returns {Promise<void>}
     */
    ensureContainerStoppedAndRemoved(
        nameOrId: string,
        networkIdOrName: string
    ) {
        const self = this

        Logger.d(`Ensuring Stopped & Removed Container: ${nameOrId}`)

        return Promise.resolve()
            .then(function () {
                Logger.d(`Stopping ${nameOrId}`)

                return self.dockerode.getContainer(nameOrId).stop({
                    t: 2,
                })
            })
            .then(function () {
                Logger.d(`Waiting to stop ${nameOrId}`)

                return Promise.race([
                    self.dockerode.getContainer(nameOrId).wait(),
                    new Promise<void>(function (resolve, reject) {
                        setTimeout(function () {
                            resolve()
                        }, 7000)
                    }),
                ])
            })
            .catch(function (error) {
                if (error && error.statusCode === 304) {
                    Logger.w(`Container already stopped: ${nameOrId}`)
                    return false
                }
                throw error
            })
            .then(function () {
                Logger.d(`Removing ${nameOrId}`)

                return self.dockerode.getContainer(nameOrId).remove({
                    force: true,
                })
            })
            .then(function () {
                return self.pruneContainers()
            })
            .then(function () {
                Logger.d(`Disconnecting from network: ${nameOrId}`)

                return self.dockerode.getNetwork(networkIdOrName).disconnect({
                    Force: true,
                    Container: nameOrId,
                })
            })
            .catch(function (error) {
                if (error && error.statusCode === 404) {
                    Logger.w(`Container not found: ${nameOrId}`)
                    return false
                }
                throw error
            })
    }

    /**
     * Creates a volume thar restarts unless stopped
     * @param containerName
     * @param imageName
     * @param volumes     an array, hostPath & containerPath, mode
     * @param arrayOfEnvKeyAndValue:
     * [
     *    {
     *        key: 'somekey'
     *        value: 'some value'
     *    }
     * ]
     * @param network
     * @param addedCapabilities
     * @returns {Promise.<>}
     */
    createStickyContainer(
        containerName: string,
        imageName: string,
        volumes: IAppVolume[],
        network: string,
        arrayOfEnvKeyAndValue: IAppEnvVar[],
        addedCapabilities: string[],
        addedSecOptions: string[],
        authObj: DockerAuthObj | undefined
    ) {
        const self = this

        Logger.d(`Creating Sticky Container: ${imageName}`)

        const volumesMapped: string[] = []
        volumes = volumes || []
        for (let i = 0; i < volumes.length; i++) {
            const v = volumes[i]
            volumesMapped.push(
                `${v.hostPath}:${v.containerPath}${v.mode ? `:${v.mode}` : ''}`
            )
        }

        const envs: string[] = []
        arrayOfEnvKeyAndValue = arrayOfEnvKeyAndValue || []
        for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
            const e = arrayOfEnvKeyAndValue[i]
            envs.push(`${e.key}=${e.value}`)
        }

        return Promise.resolve()
            .then(function () {
                return self.pullImage(imageName, authObj)
            })
            .then(function () {
                return self.dockerode.createContainer({
                    name: containerName,
                    Image: imageName,
                    Env: envs,
                    HostConfig: {
                        Binds: volumesMapped,
                        CapAdd: addedCapabilities,
                        SecurityOpt: addedSecOptions,
                        NetworkMode: network,
                        LogConfig: {
                            Type: 'json-file',
                            Config: {
                                'max-size':
                                    CaptainConstants.configs.defaultMaxLogSize,
                            },
                        },
                        RestartPolicy: {
                            Name: 'always',
                        },
                    },
                })
            })
            .then(function (data) {
                return data.start()
            })
    }

    retag(currentName: string, targetName: string) {
        const self = this
        return Promise.resolve().then(function () {
            const currentSplit = currentName.split(':')
            const targetSplit = targetName.split(':')

            if (targetSplit.length < 2 || targetSplit.length < 2) {
                throw new Error(
                    'This method only support image tags with version'
                )
            }

            if (currentSplit[currentSplit.length - 1].indexOf('/') > 0) {
                throw new Error(
                    'This method only support image tags with version - current image.'
                )
            }

            const targetVersion = targetSplit[targetSplit.length - 1]

            if (targetVersion.indexOf('/') > 0) {
                throw new Error(
                    'This method only support image tags with version - target image.'
                )
            }

            return self.dockerode.getImage(currentName).tag({
                tag: targetVersion,
                repo: targetSplit.slice(0, targetSplit.length - 1).join(':'),
            })
        })
    }

    pushImage(imageName: string, authObj: DockerAuthObj, buildLogs: BuildLog) {
        const self = this

        buildLogs.log(`Pushing to remote: ${imageName}`)
        buildLogs.log(`Server: ${authObj ? authObj.serveraddress : 'N/A'}`)
        buildLogs.log('This might take a few minutes...')

        return Promise.resolve()
            .then(function () {
                return self.dockerode.getImage(imageName).push({
                    authconfig: authObj,
                })
            })
            .then(function (stream) {
                return new Promise<void>(function (resolve, reject) {
                    let errorMessage = ''

                    stream.setEncoding('utf8')

                    // THIS BLOCK HAS TO BE HERE. "end" EVENT WON'T GET CALLED OTHERWISE.
                    stream.on('data', function (chunkRaw) {
                        Logger.dev(`stream data ${chunkRaw}`)
                        safeParseChunk(chunkRaw).forEach((chunk) => {
                            const chuckStream = chunk.stream
                            if (chuckStream) {
                                // Logger.dev('stream data ' + chuckStream);
                                buildLogs.log(chuckStream)
                            }

                            if (chunk.error) {
                                Logger.e(chunk.error)
                                const errorDetails = JSON.stringify(
                                    chunk.errorDetail
                                )
                                Logger.e(errorDetails)
                                buildLogs.log(errorDetails)
                                buildLogs.log(chunk.error)
                                errorMessage += '\n'
                                errorMessage += errorDetails
                                errorMessage += chunk.error
                            }
                        })
                    })

                    // stream.pipe(process.stdout, {end: true});
                    // IncomingMessage
                    // https://nodejs.org/api/stream.html#stream_event_end

                    stream.on('end', function () {
                        if (errorMessage) {
                            buildLogs.log('Push failed...')
                            reject(errorMessage)
                            return
                        }
                        buildLogs.log('Push succeeded...')
                        resolve()
                    })

                    stream.on('error', function (chunk) {
                        errorMessage += chunk
                    })
                })
            })
    }

    /**
     * Creates a new service
     *
     * @param imageName         REQUIRED
     * @param serviceName       REQUIRED
     * @param portsToMap        an array, containerPort & hostPort
     * @param nodeId            node ID on which we lock down the service
     * @param volumeToMount     an array, hostPath & containerPath
     * @param arrayOfEnvKeyAndValue:
     * [
     *    {
     *        key: 'somekey'
     *        value: 'some value'
     *    }
     * ]
     * @param resourcesObject:
     * [
     *    {
     *        Limits:      {   NanoCPUs	, MemoryBytes}
     *        Reservation: {   NanoCPUs	, MemoryBytes}
     *
     * ]
     */
    createServiceOnNodeId(
        imageName: string,
        serviceName: string,
        portsToMap: IAppPort[] | undefined,
        nodeId: string | undefined,
        volumeToMount: IAppVolume[] | undefined,
        arrayOfEnvKeyAndValue: IAppEnvVar[] | undefined,
        resourcesObject?: IDockerContainerResource
    ) {
        const self = this
        const ports: IDockerApiPort[] = []

        if (portsToMap) {
            for (let i = 0; i < portsToMap.length; i++) {
                const publishMode = portsToMap[i].publishMode
                const protocol = portsToMap[i].protocol
                const containerPort = portsToMap[i].containerPort
                const hostPort = portsToMap[i].hostPort

                if (protocol) {
                    const item: IDockerApiPort = {
                        Protocol: protocol,
                        TargetPort: containerPort,
                        PublishedPort: hostPort,
                    }

                    if (publishMode) {
                        item.PublishMode = publishMode
                    }

                    ports.push(item)
                } else {
                    const tcpItem: IDockerApiPort = {
                        Protocol: 'tcp',
                        TargetPort: containerPort,
                        PublishedPort: hostPort,
                    }
                    const udpItem: IDockerApiPort = {
                        Protocol: 'udp',
                        TargetPort: containerPort,
                        PublishedPort: hostPort,
                    }
                    if (publishMode) {
                        tcpItem.PublishMode = publishMode
                        udpItem.PublishMode = publishMode
                    }
                    ports.push(tcpItem)
                    ports.push(udpItem)
                }
            }
        }

        const dataToCreate: any = {
            name: serviceName,
            TaskTemplate: {
                ContainerSpec: {
                    Image: imageName,
                },
                Resources: resourcesObject,
                Placement: {
                    Constraints: nodeId ? [`node.id == ${nodeId}`] : [],
                },
                LogDriver: {
                    Name: 'json-file',
                    Options: {
                        'max-size': CaptainConstants.configs.defaultMaxLogSize,
                    },
                },
            },
            EndpointSpec: {
                Ports: ports,
            },
        }

        if (volumeToMount) {
            const mts = []
            for (let idx = 0; idx < volumeToMount.length; idx++) {
                const v = volumeToMount[idx]
                if (!v.containerPath) {
                    throw new Error(
                        'Service Create currently only supports bind volumes.'
                    )
                }
                mts.push({
                    Source: v.hostPath,
                    Target: v.containerPath,
                    Type: VolumesTypes.BIND,
                    ReadOnly: false,
                    Consistency: 'default',
                })
            }

            dataToCreate.TaskTemplate.ContainerSpec.Mounts = mts
        }

        if (arrayOfEnvKeyAndValue) {
            dataToCreate.TaskTemplate.ContainerSpec.Env = []

            for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
                const keyVal = arrayOfEnvKeyAndValue[i]
                const newSet = `${keyVal.key}=${keyVal.value}`
                dataToCreate.TaskTemplate.ContainerSpec.Env.push(newSet)
            }
        }

        return self.dockerode.createService(dataToCreate)
    }

    removeServiceByName(serviceName: string) {
        const self = this
        return self.dockerode.getService(serviceName).remove()
    }

    deleteVols(vols: string[]) {
        const self = this

        const promises: (() => Promise<void>)[] = []
        const failedVols: string[] = []

        vols.forEach((v) => {
            promises.push(function () {
                return self.dockerode
                    .getVolume(v) //
                    .remove() // { force: true }
                    .catch((err) => {
                        Logger.d(err)
                        failedVols.push(v)
                    })
            })
        })

        return Utils.runPromises(promises) //
            .then(function () {
                return failedVols
            })
    }

    isServiceRunningByName(serviceName: string) {
        return this.dockerode
            .getService(serviceName)
            .inspect()
            .then(function () {
                return true
            })
            .catch(function (error) {
                if (error && error.statusCode === 404) {
                    return false
                }
                throw error
            })
    }

    getContainerIdByServiceName(
        serviceName: string,
        retryCountMaybe?: number
    ): Promise<string> {
        const self = this
        const retryCount: number = retryCountMaybe || 0

        return self.dockerode
            .listTasks({
                filters: {
                    service: [serviceName],
                    'desired-state': ['running'],
                },
            })
            .then(function (data) {
                if (data.length >= 2) {
                    throw new Error(
                        `There must be only one instance (not ${data.length}) of the service running for sendSingleContainerKillHUP. ${serviceName}`
                    )
                }

                if (data.length === 1 && !!data[0].Status.ContainerStatus) {
                    return Promise.resolve(
                        data[0].Status.ContainerStatus.ContainerID
                    )
                }

                if (retryCount < 10) {
                    return new Promise<void>(function (resolve) {
                        setTimeout(function () {
                            resolve()
                        }, 3000)
                    }).then(function () {
                        Logger.d(
                            `Retrying to get containerId for ${serviceName} retry count:${retryCount}`
                        )

                        return self.getContainerIdByServiceName(
                            serviceName,
                            retryCount + 1
                        )
                    })
                }

                throw new Error('No containerId is found')
            })
    }

    executeCommand(serviceName: string, cmd: string[]) {
        const self = this

        return self
            .getContainerIdByServiceName(serviceName)
            .then(function (containerIdFound) {
                const cmdForLogging = (cmd || []).join(' ')
                Logger.d(
                    `executeCommand Container: ${serviceName} ${cmdForLogging} `
                )

                if (!Array.isArray(cmd)) {
                    throw new Error(
                        'Command should be an array. e.g, ["echo", "--help"] '
                    )
                }

                return self.dockerode
                    .getContainer(containerIdFound)
                    .exec({
                        AttachStdin: false,
                        AttachStdout: true,
                        AttachStderr: true,
                        Tty: true,
                        Cmd: cmd,
                    })
                    .then(function (execInstance) {
                        return execInstance.start({
                            Detach: false,
                            Tty: true,
                        })
                    })
                    .then(function (execStream) {
                        if (!execStream) {
                            throw new Error(
                                `No output from service: ${serviceName} running ${cmd}`
                            )
                        }

                        return new Promise<string>(function (resolve) {
                            let finished = false
                            let outputBody = ''

                            // output is a readable stream
                            // https://nodejs.org/api/stream.html#stream_event_end

                            execStream.setEncoding('utf8')

                            execStream.on('data', function (chunk: string) {
                                outputBody += chunk
                            })

                            execStream.on('end', function () {
                                if (finished) {
                                    return
                                }

                                finished = true
                                resolve(outputBody)
                            })

                            execStream.on('close', function () {
                                if (finished) {
                                    return
                                }

                                finished = true
                                resolve(outputBody)
                            })
                        })
                    })
            })
    }

    sendSingleContainerKillHUP(serviceName: string) {
        const self = this

        return self
            .getContainerIdByServiceName(serviceName)
            .then(function (containerIdFound) {
                Logger.d(`Kill HUP Container: ${containerIdFound}`)

                return self.dockerode.getContainer(containerIdFound).kill({
                    signal: 'HUP',
                })
            })
    }

    /**
     * Adds secret to service if it does not already have it.
     * @param serviceName
     * @param secretName
     * @returns {Promise.<>}  FALSE if the secret is JUST added, TRUE if secret existed before
     */
    ensureSecretOnService(serviceName: string, secretName: string) {
        const self = this

        let secretToExpose: Docker.Secret

        return self.dockerode
            .listSecrets({
                name: secretName,
            })
            .then(function (secrets) {
                // the filter returns all secrets whose name includes the provided secretKey. e.g., if you ask for
                // captain-me, it also returns captain-me1 and etc if exist

                for (let i = 0; i < secrets.length; i++) {
                    const specs = secrets[i].Spec
                    if (specs && specs.Name === secretName) {
                        secretToExpose = secrets[i]
                        break
                    }
                }

                if (!secretToExpose) {
                    throw new Error(`Cannot find secret: ${secretName}`)
                }

                return self.checkIfServiceHasSecret(
                    serviceName,
                    secretToExpose.ID
                )
            })
            .then(function (hasSecret) {
                if (hasSecret) {
                    Logger.d(
                        `${serviceName} (service) has already been connected to secret: ${secretName}`
                    )
                    return true
                }

                Logger.d(
                    `Adding ${secretToExpose.ID} Name:${secretName} to service: ${serviceName}`
                )

                // we only want to update the service is it doesn't have the secret. Otherwise, it keeps restarting!
                return self
                    .updateService(
                        serviceName,
                        undefined,
                        undefined,
                        undefined,
                        undefined,
                        [
                            {
                                secretName: secretName,
                                secretId: secretToExpose.ID,
                            },
                        ],
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
                    .then(function () {
                        return false
                    })
            })
    }

    checkIfServiceHasSecret(serviceName: string, secretId: string) {
        const self = this
        return self.dockerode
            .getService(serviceName)
            .inspect()
            .then(function (data) {
                const secrets = data.Spec.TaskTemplate.ContainerSpec.Secrets
                if (secrets) {
                    for (let i = 0; i < secrets.length; i++) {
                        if (secrets[i].SecretID === secretId) {
                            return true
                        }
                    }
                }
                return false
            })
    }

    ensureSecret(secretKey: string, valueIfNotExist: string) {
        const self = this

        return this.checkIfSecretExist(secretKey).then(function (secretExists) {
            if (secretExists) {
                return
            } else {
                return self.dockerode
                    .createSecret({
                        Name: secretKey,
                        Labels: {},
                        Data: Base64.encode(valueIfNotExist),
                    })
                    .then(function () {
                        return
                    })
            }
        })
    }

    checkIfSecretExist(secretKey: string) {
        const self = this

        return self.dockerode
            .listSecrets({
                name: secretKey,
            })
            .then(function (secrets) {
                // the filter returns all secrets whose name includes the provided secretKey. e.g., if you ask for
                // captain-me, it also returns captain-me1 and etc if exist

                let secretExists = false

                for (let i = 0; i < secrets.length; i++) {
                    const spec = secrets[i].Spec
                    if (spec && spec.Name === secretKey) {
                        secretExists = true
                        break
                    }
                }

                return secretExists
            })
    }

    ensureServiceConnectedToNetwork(serviceName: string, networkName: string) {
        const self = this
        let networkId: string

        return self.dockerode
            .getNetwork(networkName)
            .inspect()
            .then(function (data) {
                networkId = data.Id
                return self.dockerode.getService(serviceName).inspect()
            })
            .then(function (serviceData) {
                let availableNetworks = serviceData.Spec.TaskTemplate.Networks
                const allNetworks = []
                availableNetworks = availableNetworks || []
                for (let i = 0; i < availableNetworks.length; i++) {
                    allNetworks.push(availableNetworks[i].Target)
                    if (availableNetworks[i].Target === networkId) {
                        Logger.d(
                            `Network ${networkName} is already attached to service: ${serviceName}`
                        )
                        return
                    }
                }

                allNetworks.push(networkId)

                Logger.d(
                    `Attaching network ${networkName} to service: ${serviceName}`
                )

                return self.updateService(
                    serviceName,
                    undefined,
                    undefined,
                    allNetworks,
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
    }

    ensureOverlayNetwork(networkName: string) {
        const self = this

        return self.dockerode
            .getNetwork(networkName)
            .inspect()
            .then(function (data) {
                // Network exists!
                return true
            })
            .catch(function (error) {
                if (error && error.statusCode === 404) {
                    return self.dockerode.createNetwork({
                        Name: networkName,
                        CheckDuplicate: true,
                        Driver: 'overlay',
                        Attachable: true,
                    })
                }

                return new Promise<any>(function (resolve, reject) {
                    reject(error)
                })
            })
    }

    /**
     * @param serviceName
     * @param imageName
     * @param volumes
     * [
     *    {
     *        containerPath: 'some value' [REQUIRED]
     *        hostPath: 'somekey' [REQUIRED for bind type]
     *        volumeName: 'my-volume-name' [REQUIRED for type:volume]
     *        type: <defaults to bind>, can be volume or tmpfs (not supported yet through captain)
     *    }
     * ]
     * @param networks
     * @param arrayOfEnvKeyAndValue:
     * [
     *    {
     *        key: 'somekey'
     *        value: 'some value'
     *    }
     * ]
     * @param secrets:
     * [
     *    {
     *        secretName: 'somekey'
     *        secretId: 'some value'
     *    }
     * ]
     * @param authObject:
     * [
     *    {
     *        username: 'someuser
     *        password: 'password'
     *        serveraddress: 'registry.captain.com:996'
     *    }
     * ]
     * @param instanceCount: String '12' or null
     * @param nodeId: nodeId of the node this service will be locked to or null
     * @param namespace: String 'captain' or null
     * @returns {Promise.<>}
     */
    updateService(
        serviceName: string,
        imageName: string | undefined,
        volumes: IAppVolume[] | undefined,
        networks: string[] | undefined,
        arrayOfEnvKeyAndValue: IAppEnvVar[] | undefined,
        secrets: DockerSecret[] | undefined,
        authObject: DockerAuthObj | undefined,
        instanceCount: number | undefined,
        nodeId: string | undefined,
        namespace: string | undefined,
        ports: IAppPort[] | undefined,
        appObject: IAppDef | undefined,
        updateOrder: IDockerUpdateOrder | undefined,
        serviceUpdateOverride: any | undefined,
        preDeployFunction: PreDeployFunction | undefined
    ) {
        const self = this
        return self.dockerode
            .getService(serviceName)
            .inspect()
            .then(function (readData) {
                const data = JSON.parse(JSON.stringify(readData))

                const updatedData = data.Spec

                updatedData.version = parseInt(data.Version.Index)

                if (imageName) {
                    updatedData.TaskTemplate.ContainerSpec.Image = imageName
                }

                if (nodeId) {
                    updatedData.TaskTemplate.Placement =
                        updatedData.TaskTemplate.Placement || {}
                    updatedData.TaskTemplate.Placement.Constraints =
                        updatedData.TaskTemplate.Placement.Constraints || []
                    const newConstraints = []
                    for (
                        let i = 0;
                        i <
                        updatedData.TaskTemplate.Placement.Constraints.length;
                        i++
                    ) {
                        const c =
                            updatedData.TaskTemplate.Placement.Constraints[i]
                        if (c.indexOf('node.id') < 0) {
                            newConstraints.push(c)
                        }
                    }
                    newConstraints.push(`node.id == ${nodeId}`)
                    updatedData.TaskTemplate.Placement.Constraints =
                        newConstraints
                }

                if (arrayOfEnvKeyAndValue) {
                    updatedData.TaskTemplate.ContainerSpec.Env = []

                    for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
                        const keyVal = arrayOfEnvKeyAndValue[i]
                        const newSet = `${keyVal.key}=${keyVal.value}`
                        updatedData.TaskTemplate.ContainerSpec.Env.push(newSet)
                    }
                }

                if (ports) {
                    updatedData.EndpointSpec = updatedData.EndpointSpec || {}
                    updatedData.EndpointSpec.Ports = []
                    for (let i = 0; i < ports.length; i++) {
                        const p = ports[i]
                        if (p.protocol) {
                            updatedData.EndpointSpec.Ports.push({
                                Protocol: p.protocol,
                                TargetPort: p.containerPort,
                                PublishedPort: p.hostPort,
                            })
                        } else {
                            updatedData.EndpointSpec.Ports.push({
                                Protocol: 'tcp',
                                TargetPort: p.containerPort,
                                PublishedPort: p.hostPort,
                            })
                            updatedData.EndpointSpec.Ports.push({
                                Protocol: 'udp',
                                TargetPort: p.containerPort,
                                PublishedPort: p.hostPort,
                            })
                        }
                    }
                }

                if (volumes) {
                    const mts = []
                    for (let idx = 0; idx < volumes.length; idx++) {
                        const v = volumes[idx]

                        if (v.hostPath) {
                            mts.push({
                                Source: v.hostPath,
                                Target: v.containerPath,
                                Type: VolumesTypes.BIND,
                                ReadOnly: false,
                                Consistency: 'default',
                            })
                        } else if (v.volumeName) {
                            // named volumes are created here:
                            // /var/lib/docker/volumes/YOUR_VOLUME_NAME/_data
                            mts.push({
                                Source:
                                    (namespace ? namespace + '--' : '') +
                                    v.volumeName,
                                Target: v.containerPath,
                                Type: VolumesTypes.VOLUME,
                                ReadOnly: false,
                            })
                        } else {
                            throw new Error('Unknown volume type!!')
                        }
                    }
                    updatedData.TaskTemplate.ContainerSpec.Mounts = mts
                }

                if (networks) {
                    updatedData.TaskTemplate.Networks = []
                    for (let i = 0; i < networks.length; i++) {
                        updatedData.TaskTemplate.Networks.push({
                            Target: networks[i],
                        })
                    }
                }

                if (secrets) {
                    updatedData.TaskTemplate.ContainerSpec.Secrets =
                        updatedData.TaskTemplate.ContainerSpec.Secrets || []

                    for (let i = 0; i < secrets.length; i++) {
                        const obj = secrets[i]

                        let foundIndexSecret = -1

                        for (
                            let idx = 0;
                            idx <
                            updatedData.TaskTemplate.ContainerSpec.Secrets
                                .length;
                            idx++
                        ) {
                            if (
                                updatedData.TaskTemplate.ContainerSpec.Secrets[
                                    idx
                                ].secretId === obj.secretId
                            ) {
                                foundIndexSecret = idx
                            }
                        }
                        const objToAdd = {
                            File: {
                                Name: obj.secretName,
                                UID: '0',
                                GID: '0',
                                Mode: 292, // TODO << what is this! I just added a secret and this is how it came out with... But I don't know what it means
                            },
                            SecretID: obj.secretId,
                            SecretName: obj.secretName,
                        }

                        if (foundIndexSecret >= 0) {
                            updatedData.TaskTemplate.ContainerSpec.Secrets[
                                foundIndexSecret
                            ] = objToAdd
                        } else {
                            updatedData.TaskTemplate.ContainerSpec.Secrets.push(
                                objToAdd
                            )
                        }
                    }
                }

                if (updateOrder) {
                    updatedData.UpdateConfig = updatedData.UpdateConfig || {}

                    switch (updateOrder) {
                        case IDockerUpdateOrders.AUTO:
                            const existingVols =
                                updatedData.TaskTemplate.ContainerSpec.Mounts ||
                                []
                            updatedData.UpdateConfig.Order =
                                existingVols.length > 0
                                    ? 'stop-first'
                                    : 'start-first'
                            break
                        case IDockerUpdateOrders.START_FIRST:
                            updatedData.UpdateConfig.Order = 'start-first'
                            break
                        case IDockerUpdateOrders.STOP_FIRST:
                            updatedData.UpdateConfig.Order = 'stop-first'
                            break
                        default:
                            const neverHappens: never = updateOrder
                            throw new Error(
                                `Unknown update order! ${updateOrder}${neverHappens}`
                            )
                    }
                }

                // docker seems to be trying to smart and update if necessary!
                // but sometimes, it fails to update! no so smart, eh?
                // Using this random flag, we'll make it to update!
                // The main reason for this is NGINX. For some reason, when it sets the volume, it caches the initial
                // data from the volume and the container does not pick up changes in the host mounted volume.
                // All it takes is a restart of the container to start picking up changes. Note that it only requires
                // to restart once. Once rebooted, all changes start showing up.
                updatedData.TaskTemplate.ContainerSpec.Labels =
                    updatedData.TaskTemplate.ContainerSpec.Labels || {}
                updatedData.TaskTemplate.ContainerSpec.Labels.randomLabelForceUpdate =
                    uuid()

                updatedData.authconfig = authObject

                // TODO
                // This stupid hack is necessary. Otherwise, the following scenario will fail
                // Service is deployed (or updated) with an image from a private registry
                // Then the service is updated with a public image like nginx or something.
                // Without this hack, the update fails!!!
                // To replicate the bug:
                // - Remove this
                // - Create a manager and a worker
                // - Create a app and have it locked to the worker node
                // - Deploy a few sample apps, it works fine.
                // - Then try to deploy a simple imageName such as "nginx:1". This will fail!
                // - Even with "docker service update srv-captain--name --image nginx:1 --force" it will still fail
                // - The only way that you can make it work is by passing --wit-registry-auth flag to CLI.
                // I did some reverse engineering to see what happens under the hood, and it appears that docker uses empty user/pass
                // So I did that below, and things started working!
                // See https://github.com/docker/cli/blob/b9f150b17eea7ea8f92e3a961f666bc599bb4fdf/cli/command/service/update.go#L209
                // and
                // https://github.com/docker/cli/blob/0c444c521ff43f4341fcb2e673f93e364e8f2fcf/cli/command/registry.go#L176
                // and
                // https://github.com/docker/cli/blob/0c444c521ff43f4341fcb2e673f93e364e8f2fcf/cli/command/registry.go#L61
                if (!updatedData.authconfig) {
                    updatedData.authconfig = {
                        username: '',
                        password: '',
                        serveraddress: 'docker.io/v1',
                    }
                }
                // updatedData.registryAuthFrom = 'previous-spec'

                instanceCount = Number(instanceCount)

                if (
                    (instanceCount && instanceCount > 0) ||
                    instanceCount === 0
                ) {
                    if (!updatedData.Mode.Replicated) {
                        throw new Error(
                            'Non replicated services cannot be associated with instance count'
                        )
                    }
                    updatedData.Mode.Replicated.Replicas = instanceCount
                }

                return Utils.mergeObjects(updatedData, serviceUpdateOverride)
            })
            .then(function (updatedData) {
                if (preDeployFunction) {
                    Logger.d('Running preDeployFunction')
                    return preDeployFunction(appObject, updatedData)
                }

                return updatedData
            })
            .then(function (updatedData) {
                return self.dockerode
                    .getService(serviceName)
                    .update(updatedData)
            })
            .then(function (serviceData) {
                // give some time such that the new container is updated.
                // also we don't want to fail the update just because prune failed.
                setTimeout(function () {
                    self.pruneContainers()
                }, 5000)

                return serviceData
            })
    }

    pruneContainers() {
        Logger.d('Pruning containers...')

        const self = this
        return self.dockerode
            .pruneContainers() //
            .catch(function (error) {
                // Error: (HTTP code 409) unexpected - a prune operation is already running
                if (error && error.statusCode === 409) {
                    Logger.d('Skipping prune due to a minor error: ' + error)
                    return
                }
                Logger.d('Prune Containers Failed!')
                Logger.e(error)
            })
    }

    isNodeManager(nodeId: string) {
        const self = this
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {
                return data.Spec.Role === 'manager'
            })
    }

    getLogForService(serviceName: string, tailCount: number, encoding: string) {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return self.dockerode
                    .getService(serviceName) //
                    .logs({
                        tail: tailCount,
                        follow: false,
                        timestamps:
                            !!CaptainConstants.configs
                                .enableDockerLogsTimestamp,
                        stdout: true,
                        stderr: true,
                    })
            })
            .then(function (data) {
                if (Buffer.isBuffer(data)) {
                    return data.toString(encoding as any)
                }

                throw new Error(
                    'Logs are not instance of Buffer! Cannot be parsed!!'
                )
            })
    }

    getDockerVersion() {
        const self = this

        return Promise.resolve().then(function () {
            return self.dockerode.version()
        })
    }

    checkRegistryAuth(authObj: DockerAuthObj) {
        const self = this

        return Promise.resolve().then(function () {
            return self.dockerode.checkAuth(authObj)
        })
    }

    getDockerInfo() {
        const self = this

        return Promise.resolve().then(function () {
            return self.dockerode.info()
        })
    }

    deleteImages(imageIds: string[]) {
        const self = this

        return Promise.resolve().then(function () {
            let promises = Promise.resolve()

            for (let i = 0; i < imageIds.length; i++) {
                const imageId = imageIds[i]
                const p = function () {
                    return self.dockerode
                        .getImage(imageId)
                        .remove()
                        .then(function () {
                            Logger.d(`Image Deleted: ${imageId}`)
                        })
                        .catch(function (err) {
                            Logger.e(err)
                        })
                }

                promises = promises.then(p)
            }

            return promises
        })
    }

    getImages() {
        const self = this

        return Promise.resolve().then(function () {
            return self.dockerode.listImages()
        })
    }

    getNodeLables(nodeId: string) {
        const self = this
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {
                return data.Spec.Labels
            })
    }

    updateNodeLabels(
        nodeId: string,
        labels: IHashMapGeneric<string>,
        nodeName: string
    ) {
        const self = this
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {
                const currentLabels = data.Spec.Labels || {}
                Object.keys(labels).forEach(function (key) {
                    currentLabels[key] = labels[key]
                })

                return self.dockerode.getNode(nodeId).update({
                    version: parseInt(data.Version.Index),
                    Name: nodeName,
                    Labels: currentLabels,
                    Role: data.Spec.Role,
                    Availability: data.Spec.Availability,
                })
            })
            .then(function () {
                return true
            })
    }
}

const dockerApiAddressSplited = (EnvVars.CAPTAIN_DOCKER_API || '').split(':')
const connectionParams: Docker.DockerOptions =
    dockerApiAddressSplited.length < 2
        ? {
              socketPath: CaptainConstants.dockerSocketPath,
          }
        : dockerApiAddressSplited.length === 2
        ? {
              host: dockerApiAddressSplited[0],
              port: Number(dockerApiAddressSplited[1]),
          }
        : {
              host: `${dockerApiAddressSplited[0]}:${dockerApiAddressSplited[1]}`,
              port: Number(dockerApiAddressSplited[2]),
          }

connectionParams.version = CaptainConstants.configs.dockerApiVersion

const dockerApiInstance = new DockerApi(connectionParams)

export default DockerApi
