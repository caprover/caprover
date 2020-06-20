import ApiStatusCodes from '../../api/ApiStatusCodes'
import DockerApi from '../../docker/DockerApi'
import CaptainConstants from '../../utils/CaptainConstants'
import Logger from '../../utils/Logger'
import Utils from '../../utils/Utils'
import fs = require('fs-extra')

const WEBROOT_PATH_IN_CERTBOT = '/captain-webroot'
const WEBROOT_PATH_IN_CAPTAIN =
    CaptainConstants.captainStaticFilesDir +
    CaptainConstants.nginxDomainSpecificHtmlDir

const shouldUseStaging = false // CaptainConstants.isDebug;

class CertbotManager {
    private isOperationInProcess: boolean

    constructor(private dockerApi: DockerApi) {
        this.dockerApi = dockerApi
    }

    domainValidOrThrow(domainName: string) {
        if (!domainName) {
            throw new Error('Domain Name is empty')
        }

        const RegExpression = /^[a-z0-9\.\-]*$/

        if (!RegExpression.test(domainName)) {
            throw new Error('Bad Domain Name!')
        }
    }

    getCertRelativePathForDomain(domainName: string) {
        const self = this

        self.domainValidOrThrow(domainName)

        return '/live/' + domainName + '/fullchain.pem'
    }

    getKeyRelativePathForDomain(domainName: string) {
        const self = this

        self.domainValidOrThrow(domainName)

        return '/live/' + domainName + '/privkey.pem'
    }

    enableSsl(domainName: string) {
        const self = this

        Logger.d('Enabling SSL for ' + domainName)

        return Promise.resolve()
            .then(function () {
                self.domainValidOrThrow(domainName)
                return self.ensureDomainHasDirectory(domainName)
            })
            .then(function () {
                const cmd = [
                    'certbot',
                    'certonly',
                    '--webroot',
                    '-w',
                    WEBROOT_PATH_IN_CERTBOT + '/' + domainName,
                    '-d',
                    domainName,
                ]

                if (shouldUseStaging) {
                    cmd.push('--staging')
                }

                return self.runCommand(cmd).then(function (output) {
                    Logger.d(output)

                    if (
                        output.indexOf(
                            'Congratulations! Your certificate and chain have been saved'
                        ) >= 0
                    ) {
                        return true
                    }

                    if (
                        output.indexOf(
                            'Certificate not yet due for renewal; no action taken'
                        ) >= 0
                    ) {
                        return true
                    }

                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.VERIFICATION_FAILED,
                        'Unexpected output when enabling SSL for' +
                            domainName +
                            ' with ACME Certbot \n' +
                            output
                    )
                })
            })
    }

    ensureRegistered(emailAddress: string) {
        const self = this

        return Promise.resolve()
            .then(function () {
                // Creds used to be saved at
                // /etc/letencrypt/accounts/acme-v01.api.letsencrypt.org/directory/9fc95dbca2f0b877
                // After moving to 0.29.1, Certbot started using v2 API. and this path is no longer valid.
                // Instead, they use v02 path. However, old installations who registered with v1, will remain in the same directory
                const cmd = [
                    'certbot',
                    'register',
                    '--email',
                    emailAddress,
                    '--agree-tos',
                    '--no-eff-email',
                ]

                if (shouldUseStaging) {
                    cmd.push('--staging')
                }

                return self.runCommand(cmd)
            })
            .then(function (registerOutput) {
                if (
                    registerOutput.indexOf(
                        'Your account credentials have been saved in your Certbot'
                    ) >= 0
                ) {
                    return true
                }

                if (
                    registerOutput.indexOf('There is an existing account') >= 0
                ) {
                    return true
                }

                throw new Error(
                    'Unexpected output when registering with ACME Certbot \n' +
                        registerOutput
                )
            })
    }

    /*
  Certificate Name: customdomain-another.hm2.caprover.com
    Domains: customdomain-another.hm2.caprover.com
    Expiry Date: 2019-03-22 04:22:55+00:00 (VALID: 81 days)
    Certificate Path: /etc/letsencrypt/live/customdomain-another.hm2.caprover.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/customdomain-another.hm2.caprover.com/privkey.pem
  Certificate Name: testing.cp.hm.caprover.com
    Domains: testing.cp.hm.caprover.com
    Expiry Date: 2019-03-21 18:42:17+00:00 (VALID: 81 days)
    Certificate Path: /etc/letsencrypt/live/testing.cp.hm.caprover.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/testing.cp.hm.caprover.com/privkey.pem
  Certificate Name: registry.cp.hm.caprover.com
    Domains: registry.cp.hm.caprover.com
    Expiry Date: 2019-03-25 04:56:45+00:00 (VALID: 84 days)
    Certificate Path: /etc/letsencrypt/live/registry.cp.hm.caprover.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/registry.cp.hm.caprover.com/privkey.pem
  Certificate Name: captain.cp.hm.caprover.com
    Domains: captain.cp.hm.caprover.com
    Expiry Date: 2019-03-20 22:25:50+00:00 (VALID: 80 days)
    Certificate Path: /etc/letsencrypt/live/captain.cp.hm.caprover.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/captain.cp.hm.caprover.com/privkey.pem
  Certificate Name: testing2.cp.hm.caprover.com
    Domains: testing2.cp.hm.caprover.com
    Expiry Date: 2019-03-21 18:42:55+00:00 (VALID: 81 days)
    Certificate Path: /etc/letsencrypt/live/testing2.cp.hm.caprover.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/testing2.cp.hm.caprover.com/privkey.pem

*/
    ensureAllCurrentlyRegisteredDomainsHaveDirs() {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return self
                    .runCommand(['certbot', 'certificates'])
                    .then(function (output) {
                        const lines = output.split('\n')
                        const domains: string[] = []
                        lines.forEach((l) => {
                            if (l.indexOf('Certificate Name:') >= 0) {
                                domains.push(
                                    l.replace('Certificate Name:', '').trim()
                                )
                            }
                        })

                        return domains
                    })
            })
            .then(function (allDomains) {
                const p = Promise.resolve()
                allDomains.forEach((d) => {
                    p.then(function () {
                        return self.ensureDomainHasDirectory(d)
                    })
                })

                return p
            })
    }

    lock() {
        if (this.isOperationInProcess) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Another operation is in process for Certbot. Please wait a few seconds and try again.'
            )
        }

        this.isOperationInProcess = true
    }

    unlock() {
        this.isOperationInProcess = false
    }

    runCommand(cmd: string[]) {
        const dockerApi = this.dockerApi
        const self = this

        return Promise.resolve().then(function () {
            self.lock()

            const nonInterActiveCommand = [...cmd, '--non-interactive']
            return dockerApi
                .executeCommand(
                    CaptainConstants.certbotServiceName,
                    nonInterActiveCommand
                )
                .then(function (data) {
                    self.unlock()
                    Logger.dev(data)
                    return data
                })
                .catch(function (error) {
                    self.unlock()
                    throw error
                })
        })
    }

    ensureDomainHasDirectory(domainName: string) {
        return Promise.resolve() //
            .then(function () {
                return fs.ensureDir(WEBROOT_PATH_IN_CAPTAIN + '/' + domainName)
            })
    }

    renewAllCerts() {
        const self = this

        /*
        From Certbot docs:
            This command attempts to renew all previously-obtained certificates that expire in less than 30 days.
            The same plugin and options that were used at the time the certificate was originally issued will be
            used for the renewal attempt, unless you specify other plugins or options. Unlike certonly, renew
            acts on multiple certificates and always takes into account whether each one is near expiry. Because
            of this, renew is suitable (and designed) for automated use, to allow your system to automatically
            renew each certificate when appropriate. Since renew only renews certificates that are near expiry
            it can be run as frequently as you want - since it will usually take no action.
         */

        const cmd = ['certbot', 'renew']

        if (shouldUseStaging) {
            cmd.push('--staging')
        }

        return Promise.resolve() //
            .then(function () {
                return self.ensureAllCurrentlyRegisteredDomainsHaveDirs()
            })
            .then(function () {
                return self.runCommand(cmd)
            })
            .then(function (output) {
                // Ignore output :)
            })
            .catch(function (err) {
                Logger.e(err)
            })
    }

    init(myNodeId: string) {
        const dockerApi = this.dockerApi
        const self = this

        function createCertbotServiceOnNode(nodeId: string) {
            Logger.d('Creating Certbot service')

            return dockerApi
                .createServiceOnNodeId(
                    CaptainConstants.certbotImageName,
                    CaptainConstants.certbotServiceName,
                    undefined,
                    nodeId,
                    undefined,
                    undefined,
                    undefined
                )
                .then(function () {
                    Logger.d('Waiting for Certbot...')
                    return Utils.getDelayedPromise(12000)
                })
        }

        return Promise.resolve()
            .then(function () {
                return fs.ensureDir(CaptainConstants.letsEncryptEtcPath)
            })
            .then(function () {
                return fs.ensureDir(CaptainConstants.letsEncryptLibPath)
            })
            .then(function () {
                return fs.ensureDir(WEBROOT_PATH_IN_CAPTAIN)
            })
            .then(function () {
                return dockerApi.isServiceRunningByName(
                    CaptainConstants.certbotServiceName
                )
            })
            .then(function (isRunning) {
                if (isRunning) {
                    Logger.d('Captain Certbot is already running.. ')

                    return dockerApi.getNodeIdByServiceName(
                        CaptainConstants.certbotServiceName,
                        0
                    )
                } else {
                    Logger.d(
                        'No Captain Certbot service is running. Creating one...'
                    )

                    return createCertbotServiceOnNode(myNodeId) //
                        .then(function () {
                            return myNodeId
                        })
                }
            })
            .then(function (nodeId) {
                if (nodeId !== myNodeId) {
                    Logger.d(
                        'Captain Certbot is running on a different node. Removing...'
                    )

                    return dockerApi
                        .removeServiceByName(
                            CaptainConstants.certbotServiceName
                        )
                        .then(function () {
                            Logger.d('Waiting for Certbot to be removed...')
                            return Utils.getDelayedPromise(10000)
                        })
                        .then(function () {
                            return createCertbotServiceOnNode(myNodeId).then(
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
                Logger.d('Updating Certbot service...')

                return dockerApi.updateService(
                    CaptainConstants.certbotServiceName,
                    CaptainConstants.certbotImageName,
                    [
                        {
                            hostPath: CaptainConstants.letsEncryptEtcPath,
                            containerPath: '/etc/letsencrypt',
                        },
                        {
                            hostPath: CaptainConstants.letsEncryptLibPath,
                            containerPath: '/var/lib/letsencrypt',
                        },
                        {
                            hostPath: WEBROOT_PATH_IN_CAPTAIN,
                            containerPath: WEBROOT_PATH_IN_CERTBOT,
                        },
                    ],
                    // No need to certbot to be connected to the network
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
                return self.ensureAllCurrentlyRegisteredDomainsHaveDirs()
            })
    }
}

export default CertbotManager
