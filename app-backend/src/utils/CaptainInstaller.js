const externalIp = require('public-ip');
const DockerApi = require('../docker/DockerApi');
const CaptainConstants = require('./CaptainConstants');
const EnvVar = require('./EnvVars');

// internal IP returns Public IP if the machine is not behind a NAT
// No need to directly use Public IP.

function checkSystemReq() {

    return Promise.resolve()
        .then(function () {

            return DockerApi.get().getDockerVersion();

        })
        .then(function (output) {

            /*
                {
                  "Platform": {
                    "Name": ""
                  },
                  "Components": [
                    {
                      "Name": "Engine",
                      "Version": "17.12.0-ce",
                      "Details": {
                        "ApiVersion": "1.35",
                        "Arch": "amd64",
                        "BuildTime": "2017-12-27T20:09:53.000000000+00:00",
                        "Experimental": "false",
                        "GitCommit": "c97c6d6",
                        "GoVersion": "go1.9.2",
                        "KernelVersion": "4.4.0-104-generic",
                        "MinAPIVersion": "1.12",
                        "Os": "linux"
                      }
                    }
                  ],
                  "Version": "17.12.0-ce",
                  "ApiVersion": "1.35",
                  "MinAPIVersion": "1.12",
                  "GitCommit": "c97c6d6",
                  "GoVersion": "go1.9.2",
                  "Os": "linux",
                  "Arch": "amd64",
                  "KernelVersion": "4.4.0-104-generic",
                  "BuildTime": "2017-12-27T20:09:53.000000000+00:00"
                }
            */

            let ver = output.Components[0].Version.split('.');
            let maj = Number(ver[0]);
            let min = Number(ver[1]);

            let versionOk = false;

            if (maj > 17) {
                versionOk = true;
            }
            else if (maj === 17 && min >= 6) {
                versionOk = true;
            }

            if (versionOk) {
                console.log('   Docker Version passed.');
            }
            else {
                console.log('Warning!! Minimum Docker version is 17.06.x CaptainDuckDuck may not run properly on your Docker version.');
            }

            return DockerApi.get().getDockerInfo();

        })
        .then(function (output) {

            if (output.OperatingSystem.toLowerCase().indexOf('ubuntu') < 0) {
                console.log('Warning!!    CaptainDuckDuck and Docker work best on Ubuntu - specially when it comes to storage drivers.');
            }
            else {
                console.log('   Ubuntu detected.');
            }

            if (output.Architecture.toLowerCase().indexOf('x86') < 0) {
                console.log('Warning!!    Default CaptainDuckDuck is compiled for X86 CPU. To use CaptainDuckDuck on other CPUs you can build from the source code');
            }
            else {
                console.log('   X86 CPU detected.')
            }

            let totalMemInMb = Math.round(output.MemTotal / 1000.0 / 1000.0);

            if (totalMemInMb < 1000) {
                console.log('Warning!!    With less than 1GB RAM, complex Docker builds might fail, see CaptainDuckDuck system requirements.');
            }
            else {
                console.log('   Total RAM ' + totalMemInMb + ' MB');
            }

        })
        .catch(function (error) {
            console.log('**** WARNING!!!! System requirement check failed!  *****');
            console.error(error);
        });
}


module.exports.install = function () {
    Promise.resolve()
        .then(function () {

            return checkSystemReq();

        })
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

            if (EnvVar.DEFAULT_PASSWORD) {
                env.push({
                    key: EnvVar.keys.DEFAULT_PASSWORD,
                    value: EnvVar.DEFAULT_PASSWORD
                });
            }

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
                protocol: 'tcp',
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


