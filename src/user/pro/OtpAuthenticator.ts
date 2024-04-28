import ApiStatusCodes from '../../api/ApiStatusCodes'
import DataStore from '../../datastore/DataStore'
import { TwoFactorAuthResponse } from '../../models/IProFeatures'
import ProManager from './ProManager'

export default class OtpAuthenticator {
    constructor(
        private dataStore: DataStore,
        private proManager: ProManager
    ) {}

    set2fa(
        doEnable: boolean,
        tokenSuppliedByClient: string
    ): Promise<TwoFactorAuthResponse> {
        tokenSuppliedByClient = (tokenSuppliedByClient || '').trim()
        const self = this

        return Promise.resolve() //
            .then(function () {
                return self.dataStore.getProDataStore().isOtpEnabled()
            })
            .then(function (isEnabledNow) {
                if (isEnabledNow === doEnable) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST,
                        doEnable
                            ? 'Two factor was already enabled'
                            : 'Two factor was already disabled'
                    )
                }

                if (!doEnable) {
                    // disabling is easy, no checks, just disable in DB
                    return self.dataStore
                        .getProDataStore()
                        .setOtpEnabled(false)
                        .then(function () {
                            return { isEnabled: false }
                        })
                }

                // enabling

                if (!tokenSuppliedByClient) {
                    return self.proManager
                        .regenerateSecret() //
                        .then(function (otpPath) {
                            return { isEnabled: false, otpPath }
                        })
                } else {
                    // if token is present, compare against the secret

                    return self.proManager
                        .verifyToken(tokenSuppliedByClient) //
                        .then(function (isTokenValid) {
                            if (!isTokenValid) {
                                throw ApiStatusCodes.createError(
                                    ApiStatusCodes.ILLEGAL_OPERATION,
                                    'Entered token is invalid!'
                                )
                            }

                            return self.dataStore
                                .getProDataStore()
                                .setOtpEnabled(true)
                                .then(function () {
                                    return { isEnabled: true }
                                })
                        })
                }
            })
    }

    is2FactorEnabled(): Promise<boolean> {
        const self = this
        return Promise.resolve() //
            .then(function () {
                return self.dataStore.getProDataStore().isOtpEnabled()
            })
            .then(function (isEnabled) {
                return !!isEnabled
            })
    }

    isOtpTokenValid(providedToken: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.dataStore.getProDataStore().isOtpEnabled()
            })
            .then(function (isEnabled) {
                if (!isEnabled) {
                    return true
                }

                return self.proManager.verifyToken(providedToken)
            })
    }
}
