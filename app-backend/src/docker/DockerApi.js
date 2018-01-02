const Base64 = require('js-base64').Base64;
const Docker = require('dockerode');
const uuid = require('uuid/v4');
const util = require('util');
const CaptainConstants = require('../utils/CaptainConstants');
const Logger = require('../utils/Logger');
const EnvVars = require('../utils/EnvVars');

class DockerApi {

    constructor(connectionParams) {
        this.dockerode = new Docker(connectionParams);
    }

    initSwarm(ip, port) {

        const self = this;

        port = port || '2377';

        let advertiseAddr = ip + ':' + port;

        let swarmOptions = {
            'ListenAddr': '0.0.0.0:' + port,
            'AdvertiseAddr': advertiseAddr,
            'ForceNewCluster': false
        };

        Logger.d('Starting swarm at ' + advertiseAddr);

        return self.dockerode.swarmInit(swarmOptions);
    }


    swarmLeave(forced) {

        const self = this;

        return self.dockerode.swarmLeave({
            force: !!forced
        });
    }

    getNodeIdByServiceName(serviceName, retryCount) {

        const self = this;
        retryCount = retryCount || 0;

        return self.dockerode
            .listTasks({
                filters: {
                    service: [serviceName],
                    'desired-state': ['running']
                }
            })
            .then(function (data) {
                let nodeID = null;

                if (data.length === 1) {
                    nodeID = data[0].NodeID;
                }

                if (!nodeID) {
                    if (retryCount < 3) {
                        return new Promise(
                            function (resolve) {

                                setTimeout(function () {
                                    resolve()
                                }, 3000);

                            })
                            .then(function () {

                                Logger.d('Retrying to get NodeID for ' + serviceName + ' retry count:' + retryCount);

                                return self.getNodeIdByServiceName(serviceName, retryCount + 1);
                            });
                    }

                    throw new Error('There must be only one instance (not ' + data.length + ') of the service running to find node id. ' + serviceName);

                }

                return nodeID;

            });
    }

    getLeaderNodeId() {

        const self = this;

        return Promise.resolve()
            .then(function () {
                return self.dockerode.listNodes();
            })
            .then(function (nodes) {

                for (let idx = 0; idx < nodes.length; idx++) {
                    let node = nodes[idx];
                    if (node.ManagerStatus && node.ManagerStatus.Leader) {
                        return node.ID;
                    }
                }

            });
    }

    createJoinCommand(captainIpAddress, token) {
        return 'docker swarm join --token ' + token + ' ' + captainIpAddress + ':2377';
    }

    getNodesInfo() {

        const self = this;

        return Promise.resolve()
            .then(function () {
                return self.dockerode.listNodes();
            })
            .then(function (nodes) {

                let ret = [];

                if (!nodes || !nodes.length) {
                    return ret;
                }

                for (let i = 0; i < nodes.length; i++) {
                    let n = nodes[i];
                    ret.push({
                        nodeId: n.ID,
                        type: n.Spec.Role,
                        isLeader: n.Spec.Role === 'manager' && n.ManagerStatus && n.ManagerStatus.Leader === true,
                        hostname: n.Description.Hostname,
                        architecture: n.Description.Platform.Architecture,
                        operatingSystem: n.Description.Platform.OS,
                        nanoCpu: n.Description.Resources.NanoCPUs,
                        memoryBytes: n.Description.Resources.MemoryBytes,
                        dockerEngineVersion: n.Description.Engine.EngineVersion,
                        ip: n.Status.Addr,
                        state: n.Status.State, // whether down or ready (this means the machine is down)
                        status: n.Spec.Availability // whether active, drain or pause (this is the expected behavior)
                    });
                }

                return ret;
            });
    }

    getJoinToken(isManager) {

        const self = this;

        return Promise.resolve()
            .then(function () {
                return self.dockerode.swarmInspect();
            })
            .then(function (inspectData) {

                if (!inspectData || !inspectData.JoinTokens) {
                    throw new Error('Inspect data does not contain tokens!!');
                }

                let token = isManager ? inspectData.JoinTokens.Manager : inspectData.JoinTokens.Worker;

                if (!token) {
                    throw new Error('Inspect data does not contain the required token!!');
                }

                return token;

            });
    }

    buildImageFromDockerFile(imageName, newVersion, tarballFilePath) {

        const self = this;

        newVersion = '' + newVersion;

        Logger.d('Building docker image. This might take a few minutes...');

        return self.dockerode
            .buildImage(tarballFilePath, {
                t: imageName
            })
            .then(function (stream) {

                return new Promise(function (resolve, reject) {

                    let errorMessage = '';
                    let logsBeforeError = [];
                    for (let i = 0; i < 20; i++) {
                        logsBeforeError.push('');
                    }

                    stream.setEncoding('utf8');

                    // THIS BLOCK HAS TO BE HERE. "end" EVENT WON'T GET CALLED OTHERWISE.
                    stream.on('data', function (chunk) {

                        Logger.dev('stream data ' + chunk);
                        chunk = JSON.parse(chunk);

                        let chuckStream = chunk.stream;
                        if (chuckStream) {
                            // Logger.dev('stream data ' + chuckStream);
                            logsBeforeError.shift();
                            logsBeforeError.push(chuckStream);
                        }

                        if (chunk.error) {
                            Logger.e(chunk.error);
                            Logger.e(JSON.stringify(chunk.errorDetail));
                            errorMessage += '\n [truncated] \n';
                            errorMessage += logsBeforeError.join('');
                            errorMessage += '\n';
                            errorMessage += chunk.error;
                        }
                    });

                    // stream.pipe(process.stdout, {end: true});
                    // IncomingMessage
                    // https://nodejs.org/api/stream.html#stream_event_end

                    stream.on('end', function () {
                        if (errorMessage) {
                            reject(errorMessage);
                            return;
                        }
                        resolve();
                    });

                    stream.on('error', function (chunk) {
                        errorMessage += chunk;
                    });

                });

            })
            .then(function () {

                return self.dockerode.getImage(imageName)
                    .tag({
                        tag: newVersion,
                        repo: imageName
                    })

            });
    }

    pullImage(imageName, tag) {
        const self = this;
        tag = tag || 'latest';

        return Promise.resolve()
            .then(function () {

                return self.dockerode.createImage({
                    fromImage: imageName,
                    tag: tag
                });
            });
    }

    ensureContainerStoppedAndRemoved(nameOrId) {

        const self = this;

        Logger.d('Ensuring Stopped & Removed Container: ' + nameOrId);

        return Promise.resolve()
            .then(function () {

                return self.dockerode.getContainer(nameOrId)
                    .stop({
                        t: 2
                    });
            })
            .then(function () {

                return self.dockerode.getContainer(nameOrId)
                    .wait();
            })
            .catch(function (error) {
                if (error && error.statusCode === 304) {
                    Logger.w('Container already stopped: ' + nameOrId);
                    return false;
                }
                throw error;
            })
            .then(function () {

                return self.dockerode.getContainer(nameOrId)
                    .remove({force: true});

            })
            .catch(function (error) {
                if (error && error.statusCode === 404) {
                    Logger.w('Container not found: ' + nameOrId);
                    return false;
                }
                throw error;
            });
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
    createStickyContainer(containerName, imageName, volumes, network, arrayOfEnvKeyAndValue, addedCapabilities) {

        const self = this;

        Logger.d('Creating Sticky Container: ' + imageName);

        let volumesMapped = [];
        volumes = volumes || [];
        for (let i = 0; i < volumes.length; i++) {
            let v = volumes[i];
            volumesMapped.push(v.hostPath + ':' + v.containerPath + (v.mode ? (':' + v.mode) : ''));
        }

        let envs = [];
        arrayOfEnvKeyAndValue = arrayOfEnvKeyAndValue || [];
        for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
            let e = arrayOfEnvKeyAndValue[i];
            envs.push(e.key + '=' + e.value);
        }

        return Promise.resolve()
            .then(function () {

                let nameAndTag = imageName.split(':');
                return self.pullImage(nameAndTag[0], nameAndTag[1] || 'latest');

            })
            .then(function () {

                return self.dockerode.createContainer({
                    name: containerName,
                    Image: imageName,
                    Env: envs,
                    HostConfig: {
                        Binds: volumesMapped,
                        CapAdd: addedCapabilities,
                        NetworkMode: network
                    }
                });
            })
            .then(function (data) {

                return data.start();

            });
    }

    pushImage(imageName, newVersion, authObj) {

        const self = this;

        newVersion = '' + newVersion;

        Logger.d('Pushing to remote: ' + imageName + ':' + newVersion);
        Logger.d('Server: ' + (authObj ? authObj.serveraddress : 'N/A'));
        Logger.d('This might take a few minutes...');

        return Promise.resolve()
            .then(function () {

                return self.dockerode.getImage(imageName + ':' + newVersion)
                    .push({
                        authconfig: authObj
                    });

            })
            .then(function (stream) {

                return new Promise(function (resolve) {

                    stream.on('data', function (chunk) {
                        // THIS BLOCK HAS TO BE HERE. "end" EVENT WON'T GET CALLED OTHERWISE.
                        // ('stream data ' + chunk);
                    });


                    // stream.pipe(process.stdout, {end: true});
                    // IncomingMessage
                    // https://nodejs.org/api/stream.html#stream_event_end

                    stream.on('end', function () {
                        resolve();
                    });
                });

            });
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
    createServiceOnNodeId(imageName, serviceName, portsToMap, nodeId, volumeToMount, arrayOfEnvKeyAndValue, resourcesObject) {

        const self = this;

        let ports = [];
        if (portsToMap) {
            for (let i = 0; i < portsToMap.length; i++) {
                ports.push({
                    Protocol: 'tcp',
                    TargetPort: portsToMap[i].containerPort,
                    PublishedPort: portsToMap[i].hostPort
                });
                ports.push({
                    Protocol: 'udp',
                    TargetPort: portsToMap[i].containerPort,
                    PublishedPort: portsToMap[i].hostPort
                });
            }
        }

        let dataToCreate = {
            name: serviceName,
            TaskTemplate: {
                ContainerSpec: {
                    Image: imageName
                },
                Resources: resourcesObject,
                Placement: {
                    Constraints: nodeId ? ['node.id == ' + nodeId] : []
                },
                LogDriver: {
                    Name: 'json-file',
                    Options: {
                        'max-size': CaptainConstants.defaultMaxLogSize
                    }
                }
            },
            EndpointSpec: {
                Ports: ports
            }
        };

        if (volumeToMount) {
            let mts = [];
            for (let idx = 0; idx < volumeToMount.length; idx++) {
                let v = volumeToMount[idx];
                mts.push({
                    Source: v.hostPath,
                    Target: v.containerPath,
                    Type: 'bind',
                    ReadOnly: false,
                    Consistency: 'default'
                });
            }

            dataToCreate.TaskTemplate.ContainerSpec.Mounts = mts;
        }


        if (arrayOfEnvKeyAndValue) {
            dataToCreate.TaskTemplate.ContainerSpec.Env = [];

            for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
                let keyVal = arrayOfEnvKeyAndValue[i];
                let newSet = keyVal.key + '=' + keyVal.value;
                dataToCreate.TaskTemplate.ContainerSpec.Env.push(newSet);
            }
        }

        return self.dockerode.createService(dataToCreate);
    }

    removeService(serviceName) {
        return this.dockerode
            .getService(serviceName)
            .remove();
    }

    isServiceRunningByName(serviceName) {
        return this.dockerode
            .getService(serviceName)
            .inspect()
            .then(function () {
                return true;
            })
            .catch(function (error) {
                if (error && error.statusCode === 404) {
                    return false;
                }
                throw error;
            })
    }

    removeServiceByName(serviceName) {
        const self = this;
        return self.dockerode
            .getService(serviceName)
            .remove();
    }

    getContainerIdByServiceName(serviceName, retryCount) {

        const self = this;
        retryCount = retryCount || 0;

        return self.dockerode
            .listTasks({
                filters: {
                    service: [serviceName],
                    'desired-state': ['running']
                }
            })
            .then(function (data) {

                let containerId = null;

                if (data.length === 1) {
                    containerId = data[0].Status.ContainerStatus.ContainerID;
                }

                if (data.length >= 2) {
                    throw new Error('There must be only one instance (not ' + data.length + ') of the service running for sendSingleContainerKillHUP. ' + serviceName);
                }

                if (!containerId) {

                    if (retryCount < 3) {
                        return new Promise(
                            function (resolve) {

                                setTimeout(function () {
                                    resolve()
                                }, 3000);

                            })
                            .then(function () {

                                Logger.d('Retrying to get containerId for ' + serviceName + ' retry count:' + retryCount);

                                return self.getContainerIdByServiceName(serviceName, retryCount + 1);
                            });
                    }

                    throw new Error('No containerId is found');
                }

                return containerId;


            });
    }

    executeCommand(serviceName, cmd) {

        const self = this;

        return self
            .getContainerIdByServiceName(serviceName)
            .then(function (containerIdFound) {

                Logger.d('executeCommand Container: ' + containerIdFound);

                if (!Array.isArray(cmd)) {
                    throw new Error('Command should be an array. e.g, ["echo", "--help"] ');
                }

                return self.dockerode
                    .getContainer(containerIdFound)
                    .exec({
                        AttachStdin: false,
                        AttachStdout: true,
                        AttachStderr: true,
                        Tty: true,
                        Cmd: cmd
                    })
                    .then(function (execInstance) {

                        return execInstance.start({
                            Detach: false,
                            Tty: true
                        });

                    })
                    .then(function (data) {

                        const output = data.output; // output from the exec command

                        if (!output) {
                            throw new Error('No output from service: ' + serviceName + ' running ' + cmd);
                        }

                        return new Promise(function (resolve) {

                            let finished = false;
                            let outputBody = '';

                            // output in IncomingMessage a readable stream
                            // https://nodejs.org/api/stream.html#stream_event_end

                            output.setEncoding('utf8');

                            output.on('data', function (chunk) {
                                outputBody += chunk;
                            });

                            output.on('end', function () {

                                if (finished) {
                                    return;
                                }

                                finished = true;
                                resolve(outputBody);

                            });

                            output.on('close', function () {

                                if (finished) {
                                    return;
                                }

                                finished = true;
                                resolve(outputBody);
                            });

                        });
                    })
            });
    }

    sendSingleContainerKillHUP(serviceName) {

        const self = this;

        return self
            .getContainerIdByServiceName(serviceName)
            .then(function (containerIdFound) {

                Logger.d('Kill HUP Container: ' + containerIdFound);

                return self.dockerode.getContainer(containerIdFound).kill({
                    signal: 'HUP'
                });
            });
    }

    /**
     * Adds secret to service if it does not already have it.
     * @param serviceName
     * @param secretName
     * @returns {Promise.<>}  FALSE if the secret is JUST added, TRUE if secret existed before
     */
    ensureSecretOnService(serviceName, secretName) {

        const self = this;

        let secretToExpose = null;

        return self.dockerode
            .listSecrets({
                name: secretName
            })
            .then(function (secrets) {

                // the filter returns all secrets whose name includes the provided secretKey. e.g., if you ask for
                // captain-me, it also returns captain-me1 and etc if exist


                for (let i = 0; i < secrets.length; i++) {
                    if (secrets[i].Spec.Name === secretName) {
                        secretToExpose = secrets[i];
                        break;
                    }
                }

                if (!secretToExpose) {
                    throw new Error('Cannot find secret: ' + secretName);
                }

                return self.checkIfServiceHasSecret(serviceName, secretToExpose.ID);
            })
            .then(function (hasSecret) {

                if (hasSecret) {
                    Logger.d(serviceName + ' (service) has already been connected to secret: ' + secretName);
                    return true;
                }

                Logger.d('Adding ' + secretToExpose.ID + ' Name:' + secretName + ' to service: ' + serviceName);

                // we only want to update the service is it doesn't have the secret. Otherwise, it keeps restarting!
                return self
                    .updateService(serviceName, null, null, null, null, [{
                        secretName: secretName,
                        secretId: secretToExpose.ID
                    }])
                    .then(function () {
                        return false;
                    });

            });
    }

    checkIfServiceHasSecret(serviceName, secretId) {
        const self = this;
        return self.dockerode
            .getService(serviceName)
            .inspect()
            .then(function (data) {
                let secrets = data.Spec.TaskTemplate.ContainerSpec.Secrets;
                if (secrets) {
                    for (let i = 0; i < secrets.length; i++) {
                        if (secrets[i].SecretID === secretId) {
                            return true;
                        }
                    }
                }
                return false;
            })
    }

    ensureSecret(secretKey, valueIfNotExist) {

        const self = this;

        return this.checkIfSecretExist(secretKey)
            .then(function (secretExists) {

                if (secretExists) {
                    return true;
                }
                else {
                    return self.dockerode
                        .createSecret({
                            Name: secretKey,
                            Labels: {},
                            Data: Base64.encode(valueIfNotExist)
                        });
                }
            });
    }

    checkIfSecretExist(secretKey) {

        const self = this;

        return self.dockerode
            .listSecrets({
                name: secretKey
            })
            .then(function (secrets) {

                // the filter returns all secrets whose name includes the provided secretKey. e.g., if you ask for
                // captain-me, it also returns captain-me1 and etc if exist

                let secretExists = false;

                for (let i = 0; i < secrets.length; i++) {
                    if (secrets[i].Spec.Name === secretKey) {
                        secretExists = true;
                        break;
                    }
                }

                return secretExists;

            });
    }

    ensureServiceConnectedToNetwork(serviceName, networkName) {

        const self = this;
        let networkId = null;

        return self.dockerode
            .getNetwork(networkName)
            .inspect()
            .then(function (data) {
                networkId = data.Id;
                return self.dockerode
                    .getService(serviceName)
                    .inspect();
            })
            .then(function (serviceData) {
                let availableNetworks = serviceData.Spec.TaskTemplate.Networks;
                let allNetworks = [];
                availableNetworks = availableNetworks || [];
                for (let i = 0; i < availableNetworks.length; i++) {
                    allNetworks.push(availableNetworks[i].Target);
                    if (availableNetworks[i].Target === networkId) {
                        Logger.d('Network ' + networkName + ' is already attached to service: ' + serviceName);
                        return;
                    }
                }

                allNetworks.push(networkId);

                Logger.d('Attaching network ' + networkName + ' to service: ' + serviceName);

                return self.updateService(serviceName, null, null, allNetworks, null, null);

            })

    }

    ensureOverlayNetwork(networkName) {

        const self = this;

        return self.dockerode
            .getNetwork(networkName)
            .inspect()
            .then(function (data) {
                // Network exists!
                return true;
            })
            .catch(function (error) {

                if (error && error.statusCode === 404) {
                    return self.dockerode.createNetwork({
                        Name: networkName,
                        CheckDuplicate: true,
                        Driver: 'overlay',
                        Attachable: true
                    });
                }

                return new Promise(function (resolve, reject) {
                    reject(error);
                });

            });
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
    updateService(serviceName, imageName, volumes, networks, arrayOfEnvKeyAndValue, secrets, authObject, instanceCount, nodeId, namespace, ports) {
        const self = this;
        return self.dockerode
            .getService(serviceName)
            .inspect()
            .then(function (readData) {

                let data = JSON.parse(JSON.stringify(readData));

                let updatedData = data.Spec;

                updatedData.version = parseInt(data.Version.Index);

                if (imageName) {
                    updatedData.TaskTemplate.ContainerSpec.Image = imageName;
                }

                if (nodeId) {
                    updatedData.TaskTemplate.Placement = updatedData.TaskTemplate.Placement || {};
                    updatedData.TaskTemplate.Placement.Constraints = updatedData.TaskTemplate.Placement.Constraints || [];
                    let newConstraints = [];
                    for (let i = 0; i < updatedData.TaskTemplate.Placement.Constraints.length; i++) {
                        let c = updatedData.TaskTemplate.Placement.Constraints[i];
                        if (c.indexOf('node.id') < 0) {
                            newConstraints.push(c);
                        }
                    }
                    newConstraints.push('node.id == ' + nodeId);
                    updatedData.TaskTemplate.Placement.Constraints = newConstraints;
                }

                if (arrayOfEnvKeyAndValue) {
                    updatedData.TaskTemplate.ContainerSpec.Env = [];

                    for (let i = 0; i < arrayOfEnvKeyAndValue.length; i++) {
                        let keyVal = arrayOfEnvKeyAndValue[i];
                        let newSet = keyVal.key + '=' + keyVal.value;
                        updatedData.TaskTemplate.ContainerSpec.Env.push(newSet);
                    }
                }

                if (ports) {
                    updatedData.EndpointSpec = updatedData.EndpointSpec || {};
                    updatedData.EndpointSpec.Ports = [];
                    for (let i = 0; i < ports.length; i++) {
                        let p = ports[i];
                        updatedData.EndpointSpec.Ports.push({
                            Protocol: 'tcp',
                            TargetPort: p.containerPort,
                            PublishedPort: p.hostPort
                        });
                        updatedData.EndpointSpec.Ports.push({
                            Protocol: 'udp',
                            TargetPort: p.containerPort,
                            PublishedPort: p.hostPort
                        });
                    }
                }

                if (volumes) {
                    let mts = [];
                    for (let idx = 0; idx < volumes.length; idx++) {
                        let v = volumes[idx];

                        const TYPE_BIND = 'bind';
                        const TYPE_VOLUME = 'volume';
                        v.type = v.type || TYPE_BIND;

                        if (v.type === TYPE_BIND) {

                            mts.push({
                                Source: v.hostPath,
                                Target: v.containerPath,
                                Type: TYPE_BIND,
                                ReadOnly: false,
                                Consistency: 'default'
                            });
                        }
                        else if (v.type === TYPE_VOLUME) {

                            // named volumes are created here:
                            // /var/lib/docker/volumes/YOUR_VOLUME_NAME/_data
                            mts.push({
                                Source: (namespace ? (namespace + '--') : '') + v.volumeName,
                                Target: v.containerPath,
                                Type: TYPE_VOLUME,
                                ReadOnly: false
                            });

                        }
                        else {
                            throw new Error("Unknown volume type!!");
                        }

                    }
                    updatedData.TaskTemplate.ContainerSpec.Mounts = mts;
                }

                if (networks) {
                    updatedData.TaskTemplate.Networks = [];
                    for (let i = 0; i < networks.length; i++) {
                        updatedData.TaskTemplate.Networks.push({
                            Target: networks[i],
                        });
                    }
                }

                if (secrets) {

                    updatedData.TaskTemplate.ContainerSpec.Secrets = updatedData.TaskTemplate.ContainerSpec.Secrets || [];

                    for (let i = 0; i < secrets.length; i++) {
                        let obj = secrets[i];


                        let foundIndexSecret = -1;

                        for (let idx = 0; idx < updatedData.TaskTemplate.ContainerSpec.Secrets.length; idx++) {
                            if (updatedData.TaskTemplate.ContainerSpec.Secrets[idx].secretId === obj.secretId) {
                                foundIndexSecret = idx;
                            }
                        }
                        let objToAdd = {
                            File: {
                                Name: obj.secretName,
                                UID: "0",
                                GID: "0",
                                Mode: 292 // TODO << what is this! I just added a secret and this is how it came out with... But I don't know what it means
                            },
                            SecretID: obj.secretId,
                            SecretName: obj.secretName
                        };

                        if (foundIndexSecret >= 0) {
                            updatedData.TaskTemplate.ContainerSpec.Secrets[foundIndexSecret] = objToAdd;
                        }
                        else {
                            updatedData.TaskTemplate.ContainerSpec.Secrets.push(objToAdd);
                        }
                    }
                }

                // docker seems to be trying to smart and update if necessary!
                // but sometimes, it fails to update! no so smart, eh?
                // Using this random flag, we'll make it to update!
                // The main reason for this is NGINX. For some reason, when it sets the volume, it caches the initial
                // data from the volume and the container does not pick up changes in the host mounted volume.
                // All it takes is a restart of the container to start picking up changes. Note that it only requires
                // to restart once. Once rebooted, all changes start showing up.
                updatedData.TaskTemplate.ContainerSpec.Labels = updatedData.TaskTemplate.ContainerSpec.Labels || {};
                updatedData.TaskTemplate.ContainerSpec.Labels.randomLabelForceUpdate = uuid();

                if (authObject) {
                    updatedData.authconfig = authObject;
                }

                instanceCount = Number(instanceCount);

                if ((instanceCount && instanceCount > 0) || instanceCount === 0) {
                    if (!updatedData.Mode.Replicated) {
                        throw new Error('Non replicated services cannot be associated with instance count')
                    }
                    updatedData.Mode.Replicated.Replicas = instanceCount;
                }

                return self.dockerode.getService(serviceName)
                    .update(updatedData);
            })
            .then(function (serviceData) {

                // give some time such that the new container is updated.
                // also we don't want to fail the update just because prune failed.
                setTimeout(function () {

                    self.pruneContainers()
                        .catch(function (err) {
                            Logger.d('Prune Containers Failed!');
                            Logger.e(err);
                        });

                }, 5000);

                return serviceData;
            })
    }

    pruneContainers() {
        const self = this;
        return self.dockerode
            .pruneContainers();
    }

    isNodeManager(nodeId) {
        const self = this;
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {
                return data.Spec.Role === 'manager'
            })
    }

    getNodeLables(nodeId) {
        const self = this;
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {

                return data.Spec.Labels;

            })
    }

    updateNodeLabels(nodeId, labels, nodeName) {

        const self = this;
        return self.dockerode
            .getNode(nodeId)
            .inspect()
            .then(function (data) {

                let currentLabels = data.Spec.Labels || {};
                Object.keys(labels).forEach(function (key) {
                    currentLabels[key] = labels[key];
                });

                return self.dockerode
                    .getNode(nodeId)
                    .update({
                        version: parseInt(data.Version.Index),
                        Name: nodeName,
                        Labels: currentLabels,
                        Role: data.Spec.Role,
                        Availability: data.Spec.Availability
                    });

            })
            .then(function () {

                return true;

            })

    }
}

const dockerApiAddressSplited = (EnvVars.CAPTAIN_DOCKER_API || '').split('\:');
const connectionParams = dockerApiAddressSplited.length < 2 ?
    {socketPath: CaptainConstants.dockerSocketPath}
    :
    dockerApiAddressSplited.length === 2 ?
        {host: dockerApiAddressSplited[0], port: Number(dockerApiAddressSplited[1])} :
        {
            host: (dockerApiAddressSplited[0] + ':' + dockerApiAddressSplited[1]),
            port: Number(dockerApiAddressSplited[2])
        };

connectionParams.version = 'v1.30';

const dockerApiInstance = new DockerApi(connectionParams);

module.exports.get = function () {
    return dockerApiInstance;
};