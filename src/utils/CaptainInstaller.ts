import externalIp = require('public-ip')
import DockerApi from '../docker/DockerApi'
import CaptainConstants = require('./CaptainConstants')
import EnvVar = require('./EnvVars')
import http = require('http')
import request = require('request')
import BackupManager from '../user/system/BackupManager'

// internal IP returns Public IP if the machine is not behind a NAT
// No need to directly use Public IP.

function checkSystemReq() {
    return Promise.resolve()
        .then(function() {
            return DockerApi.get().getDockerVersion()
        })
        .then(function(output) {
            console.log(' ')
            console.log(' ')
            console.log(' ')
            console.log(' >>>> Checking System Compatibility <<<<')

            let ver = output.Version.split('.')
            let maj = Number(ver[0])
            let min = Number(ver[1])

            let versionOk = false

            if (maj > 17) {
                versionOk = true
            } else if (maj === 17 && min >= 6) {
                versionOk = true
            }

            if (versionOk) {
                console.log('   Docker Version passed.')
            } else {
                console.log(
                    'Warning!! Minimum Docker version is 17.06.x CapRover may not run properly on your Docker version.'
                )
            }

            return DockerApi.get().getDockerInfo()
        })
        .then(function(output) {
            if (output.OperatingSystem.toLowerCase().indexOf('ubuntu') < 0) {
                console.log(
                    '******* Warning *******    CapRover and Docker work best on Ubuntu - specially when it comes to storage drivers.'
                )
            } else {
                console.log('   Ubuntu detected.')
            }

            if (output.Architecture.toLowerCase().indexOf('x86') < 0) {
                console.log(
                    '******* Warning *******    Default CapRover is compiled for X86 CPU. To use CapRover on other CPUs you can build from the source code'
                )
            } else {
                console.log('   X86 CPU detected.')
            }

            let totalMemInMb = Math.round(output.MemTotal / 1000.0 / 1000.0)

            if (totalMemInMb < 1000) {
                console.log(
                    '******* Warning *******   With less than 1GB RAM, Docker builds might fail, see CapRover system requirements.'
                )
            } else {
                console.log('   Total RAM ' + totalMemInMb + ' MB')
            }
        })
        .catch(function(error) {
            console.log(' ')
            console.log(' ')
            console.log(
                '**** WARNING!!!! System requirement check failed!  *****'
            )
            console.log(' ')
            console.log(' ')
            console.error(error)
        })
}

const FIREWALL_PASSED = 'firewall-passed'

function startServerOnPort_80_443_3000() {
    return Promise.resolve().then(function() {
        http.createServer(function(req, res) {
            res.writeHead(200, {
                'Content-Type': 'text/plain',
            })
            res.write(FIREWALL_PASSED)
            res.end()
        }).listen(80)

        http.createServer(function(req, res) {
            res.writeHead(200, {
                'Content-Type': 'text/plain',
            })
            res.write(FIREWALL_PASSED)
            res.end()
        }).listen(443)

        http.createServer(function(req, res) {
            res.writeHead(200, {
                'Content-Type': 'text/plain',
            })
            res.write(FIREWALL_PASSED)
            res.end()
        }).listen(3000)

        return new Promise<void>(function(resolve) {
            setTimeout(function() {
                resolve()
            }, 4000)
        })
    })
}

function checkPortOrThrow(ipAddr: string, portToTest: number) {
    if (CaptainConstants.isDebug || !!EnvVar.BY_PASS_PROXY_CHECK) {
        return Promise.resolve()
    }

    function printError() {
        console.log(' ')
        console.log(' ')
        console.log(
            'Are your trying to run CapRover on a local machine or a machine without public IP?'
        )
        console.log(
            'In that case, you need to add this to your installation command:'
        )
        console.log("    -e MAIN_NODE_IP_ADDRESS='127.0.0.1'   ")
        console.log(' ')
        console.log(' ')
        console.log(' ')
        console.log(
            'Otherwise, if you are running CapRover on a VPS with public IP:'
        )
        console.log(
            'Your firewall may have been blocking an in-use port: ' + portToTest
        )
        console.log(
            'A simple solution on Ubuntu systems is to run "ufw disable" (security risk)'
        )
        console.log('Or [recommended] just allowing necessary ports:')
        console.log(CaptainConstants.disableFirewallCommand)
        console.log('     ')
        console.log('     ')
        console.log('See docs for more details on how to fix firewall issues')
        console.log(' ')
        console.log(
            'Finally, if you are an advanced user, and you want to bypass this check (NOT RECOMMENDED),'
        )
        console.log(
            "you can append the docker command with an addition flag: -e BY_PASS_PROXY_CHECK='TRUE'"
        )
        console.log(' ')
        console.log(' ')
    }

    return new Promise<void>(function(resolve, reject) {
        let finished = false

        setTimeout(function() {
            if (finished) {
                return
            }

            finished = true

            printError()
            reject(new Error('Port timed out: ' + portToTest))
        }, 5000)

        request('http://' + ipAddr + ':' + portToTest, function(
            error,
            response,
            body
        ) {
            if (finished) {
                return
            }

            finished = true

            if (body + '' === FIREWALL_PASSED) {
                resolve()
            } else {
                printError()
                reject(new Error('Port seems to be closed: ' + portToTest))
            }
        })
    })
}

function printTroubleShootingUrl() {
    console.log('     ')
    console.log(' Installation of CapRover is starting...     ')
    console.log(
        'For troubleshooting, please see: https://caprover.com/docs/troubleshooting.html'
    )
    console.log('     ')
    console.log('     ')
}

let myIp4: string

export function install() {
    const backupManger = new BackupManager()

    Promise.resolve()
        .then(function() {
            printTroubleShootingUrl()
        })
        .then(function() {
            return checkSystemReq()
        })
        .then(function() {
            if (EnvVar.MAIN_NODE_IP_ADDRESS) {
                return EnvVar.MAIN_NODE_IP_ADDRESS
            }

            return externalIp.v4()
        })
        .then(function(ip4) {
            if (!ip4) {
                throw new Error(
                    'Something went wrong. No IP address was retrieved.'
                )
            }

            if (CaptainConstants.isDebug) {
                return new Promise<string>(function(resolve, reject) {
                    DockerApi.get()
                        .swarmLeave(true)
                        .then(function(ignore) {
                            resolve(ip4)
                        })
                        .catch(function(error) {
                            if (error && error.statusCode === 503) {
                                resolve(ip4)
                            } else {
                                reject(error)
                            }
                        })
                })
            } else {
                return ip4
            }
        })
        .then(function(ip4) {
            myIp4 = '' + ip4

            return startServerOnPort_80_443_3000()
        })
        .then(function() {
            return checkPortOrThrow(myIp4, 80)
        })
        .then(function() {
            return checkPortOrThrow(myIp4, 443)
        })
        .then(function() {
            return checkPortOrThrow(myIp4, 3000)
        })
        .then(function() {
            const imageName = CaptainConstants.configs.nginxImageName
            console.log('Pulling: ' + imageName)
            return DockerApi.get().pullImage(imageName, undefined)
        })
        .then(function() {
            const imageName = CaptainConstants.configs.appPlaceholderImageName
            console.log('Pulling: ' + imageName)
            return DockerApi.get().pullImage(imageName, undefined)
        })
        .then(function() {
            const imageName = CaptainConstants.certbotImageName
            console.log('Pulling: ' + imageName)
            return DockerApi.get().pullImage(imageName, undefined)
        })
        .then(function() {
            return backupManger.checkAndPrepareRestoration()
        })
        .then(function() {
            return DockerApi.get().initSwarm(myIp4)
        })
        .then(function(swarmId: string) {
            console.log('Swarm started: ' + swarmId)
            return backupManger.startRestorationIfNeededPhase1(myIp4)
        })
        .then(function() {
            return DockerApi.get().getLeaderNodeId()
        })
        .then(function(nodeId: string) {
            let volumeToMount = [
                {
                    hostPath: CaptainConstants.captainBaseDirectory,
                    containerPath: CaptainConstants.captainBaseDirectory,
                },
            ]

            let env = [] as IAppEnvVar[]
            env.push({
                key: EnvVar.keys.IS_CAPTAIN_INSTANCE,
                value: '1',
            })

            if (EnvVar.DEFAULT_PASSWORD) {
                env.push({
                    key: EnvVar.keys.DEFAULT_PASSWORD,
                    value: EnvVar.DEFAULT_PASSWORD,
                })
            }

            if (EnvVar.CAPTAIN_DOCKER_API) {
                env.push({
                    key: EnvVar.keys.CAPTAIN_DOCKER_API,
                    value: EnvVar.CAPTAIN_DOCKER_API,
                })
            } else {
                volumeToMount.push({
                    hostPath: CaptainConstants.dockerSocketPath,
                    containerPath: CaptainConstants.dockerSocketPath,
                })
            }

            let ports: IAppPort[] = []

            let captainNameAndVersion =
                CaptainConstants.configs.publishedNameOnDockerHub +
                ':' +
                CaptainConstants.configs.version

            if (CaptainConstants.isDebug) {
                captainNameAndVersion =
                    CaptainConstants.configs.publishedNameOnDockerHub // debug doesn't have version.

                env.push({
                    key: EnvVar.keys.CAPTAIN_IS_DEBUG,
                    value: EnvVar.CAPTAIN_IS_DEBUG + '',
                })

                volumeToMount.push({
                    hostPath: CaptainConstants.debugSourceDirectory,
                    containerPath: CaptainConstants.sourcePathInContainer,
                })

                ports.push({
                    containerPort: 38000,
                    hostPort: 38000,
                })
            }

            ports.push({
                protocol: 'tcp',
                containerPort: CaptainConstants.captainServiceExposedPort,
                hostPort: CaptainConstants.captainServiceExposedPort,
            })

            return DockerApi.get().createServiceOnNodeId(
                captainNameAndVersion,
                CaptainConstants.captainServiceName,
                ports,
                nodeId,
                volumeToMount,
                env,
                {
                    Reservation: {
                        MemoryBytes: 100 * 1024 * 1024,
                    },
                }
            )
        })
        .catch(function(error) {
            console.log('Installation failed.')
            console.error(error)
        })
        .then(function() {
            process.exit()
        })
}
