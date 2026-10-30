import configstore = require('configstore')
import { randomBytes } from 'crypto'
import ApiStatusCodes from '../api/ApiStatusCodes'
import { IPasskeySaved } from '../models/IPasskey'
import Utils from '../utils/Utils'

const PASSKEYS = 'passkeys'
const PASSKEY_USER_ID = 'passkeyUserId'

class PasskeysDataStore {
    constructor(private data: configstore) {}

    getAllPasskeys(): Promise<IPasskeySaved[]> {
        const self = this
        return Promise.resolve().then(function () {
            return Utils.copyObject(
                (self.data.get(PASSKEYS) || []) as IPasskeySaved[]
            )
        })
    }

    getPasskeyById(passkeyId: string): Promise<IPasskeySaved | undefined> {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getAllPasskeys()
            })
            .then(function (passkeys) {
                return passkeys.find((it) => it.id === passkeyId)
            })
    }

    addPasskey(passkey: IPasskeySaved) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getAllPasskeys()
            })
            .then(function (passkeys) {
                if (passkeys.some((it) => it.id === passkey.id)) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.STATUS_ERROR_ALREADY_EXIST,
                        'This passkey is already registered'
                    )
                }
                passkeys.push(passkey)
                self.data.set(PASSKEYS, passkeys)
            })
    }

    updatePasskeyUsage(passkeyId: string, counter: number, lastUsedAt: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getAllPasskeys()
            })
            .then(function (passkeys) {
                passkeys.forEach((it) => {
                    if (it.id === passkeyId) {
                        it.counter = counter
                        it.lastUsedAt = lastUsedAt
                    }
                })
                self.data.set(PASSKEYS, passkeys)
            })
    }

    deletePasskey(passkeyId: string) {
        const self = this
        return Promise.resolve()
            .then(function () {
                return self.getAllPasskeys()
            })
            .then(function (passkeys) {
                const remaining = passkeys.filter((it) => it.id !== passkeyId)
                if (remaining.length === passkeys.length) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.NOT_FOUND,
                        'Passkey not found'
                    )
                }
                self.data.set(PASSKEYS, remaining)
            })
    }

    /**
     * WebAuthn user handle for the single CapRover user. Random, stable, never
     * derived from anything personal.
     */
    getOrCreateUserId(): Promise<string> {
        const self = this
        return Promise.resolve().then(function () {
            let userId = self.data.get(PASSKEY_USER_ID) as string | undefined
            if (!userId) {
                userId = randomBytes(32).toString('base64url')
                self.data.set(PASSKEY_USER_ID, userId)
            }
            return userId
        })
    }
}

export default PasskeysDataStore
