import jwt = require('jsonwebtoken')
import { v4 as uuid } from 'uuid'
import ApiStatusCodes from '../api/ApiStatusCodes'
import { UserJwt } from '../models/UserJwt'
import CaptainConstants from '../utils/CaptainConstants'
import EnvVar from '../utils/EnvVars'
import Logger from '../utils/Logger'
import bcrypt = require('bcryptjs')
import { IHashMapGeneric } from '../models/ICacheGeneric'

const captainDefaultPassword = EnvVar.DEFAULT_PASSWORD || 'captain42'

const COOKIE_AUTH_SUFFIX = 'cookie-'
const WEBHOOK_APP_PUSH_SUFFIX = '-webhook-app-push'
const DOWNLOAD_TOKEN = '-download-token'

export interface OtpConfig {
    otpToken: string
    otpAuthenticator: {
        // getting around circular dependency
        isOtpTokenValid: (providedToken: string) => Promise<boolean>
    }
}

class Authenticator {
    private encryptionKey: string
    private namespace: string
    private tokenVersion: string

    constructor(secret: string, namespace: string) {
        this.encryptionKey = secret + namespace // making encryption key unique per namespace!
        this.namespace = namespace
        this.tokenVersion = CaptainConstants.isDebug ? 'test' : uuid()
    }

    changepass(oldPass: string, newPass: string, savedHashedPassword: string) {
        const self = this

        oldPass = oldPass || ''
        newPass = newPass || ''

        return Promise.resolve()
            .then(function () {
                if (!oldPass || !newPass || newPass.length < 8) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_GENERIC,
                        'Password is too small.'
                    )
                }

                return self.isPasswordCorrect(oldPass, savedHashedPassword)
            })
            .then(function (isPasswordCorrect) {
                if (!isPasswordCorrect) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_WRONG_PASSWORD,
                        'Old password is incorrect.'
                    )
                }

                self.tokenVersion = uuid()

                const hashed = bcrypt.hashSync(
                    self.encryptionKey + newPass,
                    bcrypt.genSaltSync(10)
                )

                return hashed
            })
    }

    isPasswordCorrect(password: string, savedHashedPassword: string) {
        const self = this

        return Promise.resolve().then(function () {
            password = password || ''

            if (!savedHashedPassword) {
                return captainDefaultPassword === password
            }

            return bcrypt.compareSync(
                self.encryptionKey + password,
                savedHashedPassword
            )
        })
    }

    getAuthTokenForCookies(
        otpConfig: OtpConfig,
        password: string,
        savedHashedPassword: string
    ) {
        return this.getAuthToken(
            otpConfig,
            password,
            savedHashedPassword,
            COOKIE_AUTH_SUFFIX
        )
    }

    getAuthToken(
        otpConfig: OtpConfig,
        password: string,
        savedHashedPassword: string,
        keySuffix?: string
    ) {
        const self = this

        // intentionally same error to avoid giving bad actors any hints
        const INVALID_CREDS_ERROR = 'Invalid credentials'

        return Promise.resolve()
            .then(function () {
                return otpConfig.otpAuthenticator.isOtpTokenValid(
                    otpConfig.otpToken
                )
            })
            .then(function (otpValid) {
                if (!otpValid) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_WRONG_PASSWORD,
                        INVALID_CREDS_ERROR
                    )
                }
                return self.isPasswordCorrect(password, savedHashedPassword)
            })
            .then(function (isPasswordCorrect) {
                if (!isPasswordCorrect) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_WRONG_PASSWORD,
                        INVALID_CREDS_ERROR
                    )
                }

                const userObj: UserJwt = {
                    namespace: self.namespace,
                    tokenVersion: self.tokenVersion,
                }

                return jwt.sign(
                    {
                        data: userObj,
                    },
                    self.encryptionKey + (keySuffix ? keySuffix : ''),
                    { expiresIn: '480h' }
                )
            })
    }

    decodeAuthTokenFromCookies(token: string) {
        return this.decodeAuthToken(token, COOKIE_AUTH_SUFFIX)
    }

    decodeAuthToken(token: string, keySuffix?: string) {
        const self = this

        return new Promise<UserJwt>(function (resolve, reject) {
            jwt.verify(
                token,
                self.encryptionKey + (keySuffix ? keySuffix : ''),
                function (err, rawDecoded: { data: UserJwt }) {
                    if (err) {
                        Logger.e(err)
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                'Auth token corrupted'
                            )
                        )
                        return
                    }

                    const decodedData = rawDecoded.data

                    if (decodedData.tokenVersion !== self.tokenVersion) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                'Auth token is no longer valid. Request for a new auth token'
                            )
                        )
                        return
                    }

                    if (decodedData.namespace !== self.namespace) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                'Auth token does not match the namespace'
                            )
                        )
                        return
                    }

                    resolve(decodedData)
                }
            )
        })
    }

    getAppPushWebhookToken(appName: string, tokenVersion: string) {
        const self = this

        if (!appName) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'App name are required for webhook token..'
            )
        }

        return self.getGenericToken(
            {
                tokenVersion: tokenVersion,
                appName: appName,
            },
            WEBHOOK_APP_PUSH_SUFFIX
        )
    }

    decodeAppPushWebhookToken(token: string) {
        const self = this

        return self.decodeGenericToken(token, WEBHOOK_APP_PUSH_SUFFIX)
    }

    getDownloadToken(downloadFileName: string) {
        const self = this

        if (!downloadFileName) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'filename is required for download token..'
            )
        }

        return self.getGenericToken(
            {
                downloadFileName: downloadFileName,
            },
            DOWNLOAD_TOKEN,
            '2m'
        )
    }

    decodeDownloadToken(token: string) {
        const self = this

        return self.decodeGenericToken(token, DOWNLOAD_TOKEN)
    }

    getGenericToken(obj: any, keySuffix: string, expiresIn?: string) {
        const self = this
        obj.namespace = self.namespace

        return Promise.resolve().then(function () {
            return jwt.sign(
                {
                    data: obj,
                },
                self.encryptionKey + (keySuffix ? keySuffix : ''),
                expiresIn
                    ? {
                          expiresIn: expiresIn,
                      }
                    : undefined
            )
        })
    }

    decodeGenericToken(token: string, keySuffix: string) {
        const self = this

        return new Promise<any>(function (resolve, reject) {
            jwt.verify(
                token,
                self.encryptionKey + (keySuffix ? keySuffix : ''),
                function (err, rawDecoded: { data: any }) {
                    if (err) {
                        Logger.e(err)
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                'Token corrupted'
                            )
                        )
                        return
                    }

                    const decodedData = rawDecoded.data

                    if (decodedData.namespace !== self.namespace) {
                        reject(
                            ApiStatusCodes.createError(
                                ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID,
                                'token does not match the namespace'
                            )
                        )
                        return
                    }

                    resolve(decodedData)
                }
            )
        })
    }

    static authenticatorCache: IHashMapGeneric<Authenticator> = {}

    private static mainSalt: string

    static setMainSalt(salt: string) {
        if (Authenticator.mainSalt) throw new Error('Salt is already set!!')
        Authenticator.mainSalt = salt
    }

    static getAuthenticator(namespace: string): Authenticator {
        const authenticatorCache = Authenticator.authenticatorCache
        if (!namespace) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
                'Empty namespace'
            )
        }

        if (!authenticatorCache[namespace]) {
            const captainSalt = Authenticator.mainSalt
            if (captainSalt) {
                authenticatorCache[namespace] = new Authenticator(
                    captainSalt,
                    namespace
                )
            } else {
                throw new Error('Salt is not set! Cannot create authenticator')
            }
        }

        return authenticatorCache[namespace]
    }
}

export default Authenticator
