import LoadBalancerManager = require('./LoadBalancerManager')
import CertbotManager = require('./CertbotManager')
import CaptainConstants = require('../../utils/CaptainConstants')
import Logger = require('../../utils/Logger')
import request = require('request')
import ApiStatusCodes = require('../../api/ApiStatusCodes')
import uuid = require('uuid/v4')
import fs = require('fs-extra')
import Utils from '../../utils/Utils'

export default class DomainResolveChecker {
    constructor(
        private loadBalancerManager: LoadBalancerManager,
        private certbotManager: CertbotManager
    ) {}

    requestCertificateForDomain(domainName: string) {
        return this.certbotManager.enableSsl(domainName)
    }

    /**
     * Returns a promise successfully if verification is succeeded. If it fails, it throws an exception.
     *
     * @param domainName the domain to verify, app.mycaptainroot.com or www.myawesomeapp.com
     * @param identifierSuffix an optional suffix to be added to the identifier file name to avoid name conflict
     *
     * @returns {Promise.<boolean>}
     */
    verifyCaptainOwnsDomainOrThrow(
        domainName: string,
        identifierSuffix: string | undefined
    ) {
        if (CaptainConstants.configs.skipVerifyingDomains) {
            return Utils.getDelayedPromise(1000)
        }

        const self = this
        const randomUuid = uuid()
        const captainConfirmationPath =
            CaptainConstants.captainConfirmationPath +
            (identifierSuffix ? identifierSuffix : '')

        return Promise.resolve()
            .then(function() {
                return self.certbotManager.domainValidOrThrow(domainName)
            })
            .then(function() {
                return fs.outputFile(
                    CaptainConstants.captainStaticFilesDir +
                        CaptainConstants.nginxDomainSpecificHtmlDir +
                        '/' +
                        domainName +
                        captainConfirmationPath,
                    randomUuid
                )
            })
            .then(function() {
                return new Promise<void>(function(resolve) {
                    setTimeout(function() {
                        resolve()
                    }, 1000)
                })
            })
            .then(function() {
                return new Promise<void>(function(resolve, reject) {
                    const url =
                        'http://' +
                        domainName +
                        ':' +
                        CaptainConstants.nginxPortNumber +
                        captainConfirmationPath

                    request(
                        url,

                        function(error, response, body) {
                            if (error || !body || body !== randomUuid) {
                                Logger.e(
                                    'Verification Failed for ' + domainName
                                )
                                Logger.e('Error        ' + error)
                                Logger.e('body         ' + body)
                                Logger.e('randomUuid   ' + randomUuid)
                                reject(
                                    ApiStatusCodes.createError(
                                        ApiStatusCodes.VERIFICATION_FAILED,
                                        'Verification Failed.'
                                    )
                                )
                                return
                            }

                            resolve()
                        }
                    )
                })
            })
    }

    verifyDomainResolvesToDefaultServerOnHost(domainName: string) {
        if (CaptainConstants.configs.skipVerifyingDomains) {
            return Utils.getDelayedPromise(1000)
        }

        const self = this

        return new Promise<void>(function(resolve, reject) {
            const url =
                'http://' +
                domainName +
                CaptainConstants.captainConfirmationPath

            Logger.d('Sending request to ' + url)

            request(url, function(error, response, body) {
                if (
                    error ||
                    !body ||
                    body !==
                        self.loadBalancerManager.getCaptainPublicRandomKey()
                ) {
                    reject(
                        ApiStatusCodes.createError(
                            ApiStatusCodes.VERIFICATION_FAILED,
                            'Verification Failed.'
                        )
                    )
                    return
                }

                resolve()
            })
        })
    }
}
