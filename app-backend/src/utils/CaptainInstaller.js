const externalIp = require('public-ip');
const DockerApi = require('../docker/DockerApi');
const CaptainConstants = require('./CaptainConstants');
const EnvVar = require('./EnvVars');

// internal IP returns Public IP if the machine is not behind a NAT
// No need to directly use Public IP.

module.exports.install = function () {
    Promise.resolve()
        .then(function () {

            if (EnvVar.MAIN_NODE_IP_ADDRESS) {
                return EnvVar.MAIN_NODE_IP_ADDRESS;
            }

            return externalIp.v4();

        })
        .then(function (ip4) {

            if (!ip4) {
                throw new Error('Something went wrong. No IP address was retrieved.');
            }

            if (CaptainConstants.isDebug) {
                return new Promise(function (resolve, reject) {
                    DockerApi.get().swarmLeave(true)
                        .then(function (ignore) {
                            resolve(ip4);
                        })
                        .catch(function (error) {
                            if (error && error.statusCode === 503) {
                                resolve(ip4);
                            }
                            else {
                                reject(error);
                            }
                        });
                });
            }
            else {
                return ip4;
            }
        })
        .then(function (ip4) {
            return DockerApi.get().initSwarm(ip4);
        })
        .then(function (swarmId) {

            console.log('Swarm started: ' + swarmId);
            return DockerApi.get().getLeaderNodeId();

        })
        .then(function (nodeId) {

            let volumeToMount = [
                {
                    hostPath: CaptainConstants.captainRootDirectory,
                    containerPath: CaptainConstants.captainRootDirectory
                }
            ];

            let env = [];
            env.push({
                key: EnvVar.keys.IS_CAPTAIN_INSTANCE,
                value: '1'
            });

            if (EnvVar.CAPTAIN_DOCKER_API) {
                env.push({
                    key: EnvVar.keys.CAPTAIN_DOCKER_API,
                    value: EnvVar.CAPTAIN_DOCKER_API
                });
            }
            else {
                volumeToMount.push({
                    hostPath: CaptainConstants.dockerSocketPath,
                    containerPath: CaptainConstants.dockerSocketPath
                })
            }

            let ports = [];

            let captainNameAndVersion = CaptainConstants.publishedNameOnDockerHub + ':' + CaptainConstants.version;

            if (CaptainConstants.isDebug) {

                captainNameAndVersion = CaptainConstants.publishedNameOnDockerHub; //debug doesn't have version.

                env.push({
                    key: EnvVar.keys.CAPTAIN_IS_DEBUG,
                    value: EnvVar.CAPTAIN_IS_DEBUG
                });

                volumeToMount.push({
                    hostPath: CaptainConstants.debugSourceDirectory,
                    containerPath: CaptainConstants.sourcePathInContainer
                });

                ports.push({
                    containerPort: 38000,
                    hostPort: 38000
                });

            }

            ports.push({
                containerPort: CaptainConstants.captainServiceExposedPort,
                hostPort: CaptainConstants.captainServiceExposedPort
            });

            return DockerApi.get().createServiceOnNodeId(captainNameAndVersion,
                CaptainConstants.captainServiceName, ports, nodeId, volumeToMount, env, {
                    Reservation: {
                        MemoryBytes: 100 * 1024 * 1024
                    }
                });

        })
        .catch(function (error) {
            console.log('Installation failed.');
            console.error(error);
        });
};


