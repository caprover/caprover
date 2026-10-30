import {
    AuthenticationResponseJSON,
    generateAuthenticationOptions,
    generateRegistrationOptions,
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from '@simplewebauthn/server'
import {
    decodeClientDataJSON,
    isoBase64URL,
} from '@simplewebauthn/server/helpers'
import { randomBytes } from 'crypto'
import ApiStatusCodes from '../api/ApiStatusCodes'
import PasskeysDataStore from '../datastore/PasskeysDataStore'
import { IPasskeySummary } from '../models/IPasskey'
import CaptainConstants from '../utils/CaptainConstants'
import EnvVars from '../utils/EnvVars'
import Logger from '../utils/Logger'

export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000
const MAX_PENDING_CHALLENGES = 1000
const MAX_PASSKEY_NAME_LENGTH = 50

// intentionally same error to avoid giving bad actors any hints (same as password login)
const INVALID_CREDS_ERROR = 'Invalid credentials'

type ChallengePurpose = 'registration' | 'authentication'

/**
 * In-memory, single-use challenges with a short TTL, indexed by a key (the
 * login session id for authentication). Lost on restart, which only means an
 * in-flight ceremony has to be started again.
 *
 * When full, new challenges are refused instead of evicting old ones, so
 * flooding cannot invalidate a challenge already handed to another client.
 */
export class PasskeyChallengeStore {
    private challenges = new Map<
        string,
        { challenge: string; purpose: ChallengePurpose; expiresAt: number }
    >()

    constructor(
        private now: () => number = Date.now,
        private maxPending: number = MAX_PENDING_CHALLENGES
    ) {}

    add(key: string, challenge: string, purpose: ChallengePurpose): boolean {
        const currentTime = this.now()
        this.challenges.forEach((value, existingKey) => {
            if (value.expiresAt <= currentTime)
                this.challenges.delete(existingKey)
        })

        if (this.challenges.size >= this.maxPending) return false

        this.challenges.set(key, {
            challenge,
            purpose,
            expiresAt: currentTime + PASSKEY_CHALLENGE_TTL_MS,
        })
        return true
    }

    /**
     * Removes the entry whatever the outcome, so it can never be used twice.
     */
    consume(key: string, purpose: ChallengePurpose): string | undefined {
        if (!key) return undefined
        const entry = this.challenges.get(key)
        this.challenges.delete(key)
        return entry &&
            entry.purpose === purpose &&
            entry.expiresAt > this.now()
            ? entry.challenge
            : undefined
    }
}

function tooManyPendingError() {
    return ApiStatusCodes.createError(
        ApiStatusCodes.STATUS_PASSWORD_BACK_OFF,
        'Too many pending passkey requests. Wait a few minutes and retry.'
    )
}

export interface PasskeyRelyingParty {
    rpID: string
    origins: string[]
}

/**
 * Default: RP ID = captain.<root-domain>, origin = https://captain.<root-domain>.
 * Overrides: CAPTAIN_PASSKEY_RP_ID and CAPTAIN_PASSKEY_ORIGINS (comma-separated).
 */
export function resolvePasskeyRelyingParty(
    rootDomain: string
): PasskeyRelyingParty {
    const dashboardHost = `${CaptainConstants.configs.captainSubDomain}.${rootDomain}`
    const rpID =
        `${EnvVars.CAPTAIN_PASSKEY_RP_ID || ''}`.trim() || dashboardHost
    const originsOverride = `${EnvVars.CAPTAIN_PASSKEY_ORIGINS || ''}`
        .split(',')
        .map((it) => it.trim())
        .filter((it) => !!it)

    return {
        rpID,
        origins: originsOverride.length
            ? originsOverride
            : [`https://${dashboardHost}`],
    }
}

function extractChallenge(clientDataJSON: unknown) {
    try {
        return `${decodeClientDataJSON(`${clientDataJSON || ''}`).challenge || ''}`
    } catch {
        return ''
    }
}

export interface PasskeyDataSource {
    getRootDomain(): string
    getPasskeysDataStore(): PasskeysDataStore
}

class PasskeyManager {
    // separate stores: the public login flow can never crowd out registration
    private static registrationChallengeStore = new PasskeyChallengeStore()
    private static authenticationChallengeStore = new PasskeyChallengeStore()

    constructor(
        private dataSource: PasskeyDataSource,
        private challengeStore?: PasskeyChallengeStore,
        private now: () => Date = () => new Date()
    ) {}

    private storeFor(purpose: ChallengePurpose) {
        if (this.challengeStore) return this.challengeStore
        return purpose === 'registration'
            ? PasskeyManager.registrationChallengeStore
            : PasskeyManager.authenticationChallengeStore
    }

    private getRelyingParty() {
        return resolvePasskeyRelyingParty(this.dataSource.getRootDomain())
    }

    getRegistrationOptions(): Promise<PublicKeyCredentialCreationOptionsJSON> {
        const self = this
        const passkeysDataStore = self.dataSource.getPasskeysDataStore()

        return Promise.all([
            passkeysDataStore.getAllPasskeys(),
            passkeysDataStore.getOrCreateUserId(),
        ])
            .then(function ([passkeys, userId]) {
                return generateRegistrationOptions({
                    rpName: 'CapRover',
                    rpID: self.getRelyingParty().rpID,
                    userName: 'captain',
                    userDisplayName: 'CapRover',
                    userID: isoBase64URL.toBuffer(userId),
                    timeout: PASSKEY_CHALLENGE_TTL_MS,
                    attestationType: 'none',
                    excludeCredentials: passkeys.map((it) => ({
                        id: it.id,
                        transports: it.transports,
                    })),
                    authenticatorSelection: {
                        residentKey: 'required',
                        userVerification: 'required',
                    },
                })
            })
            .then(function (options) {
                if (
                    !self
                        .storeFor('registration')
                        .add(
                            options.challenge,
                            options.challenge,
                            'registration'
                        )
                ) {
                    throw tooManyPendingError()
                }
                return options
            })
    }

    verifyRegistration(
        name: string,
        response: RegistrationResponseJSON
    ): Promise<IPasskeySummary> {
        const self = this
        const passkeyName = `${name || ''}`.trim()
        const relyingParty = self.getRelyingParty()

        return Promise.resolve()
            .then(function () {
                // consume first: the challenge is spent even if anything below fails
                const challenge = extractChallenge(
                    response?.response?.clientDataJSON
                )
                const challengeValid =
                    !!challenge &&
                    self
                        .storeFor('registration')
                        .consume(challenge, 'registration') === challenge

                if (
                    !passkeyName ||
                    passkeyName.length > MAX_PASSKEY_NAME_LENGTH
                ) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.ILLEGAL_PARAMETER,
                        `Passkey name is required (max ${MAX_PASSKEY_NAME_LENGTH} characters)`
                    )
                }

                if (!challengeValid) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.VERIFICATION_FAILED,
                        'Passkey challenge expired or invalid. Try again.'
                    )
                }

                return verifyRegistrationResponse({
                    response,
                    expectedChallenge: challenge,
                    expectedOrigin: relyingParty.origins,
                    expectedRPID: relyingParty.rpID,
                    requireUserVerification: true,
                }).catch(function (err) {
                    Logger.e(err)
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.VERIFICATION_FAILED,
                        'Passkey registration could not be verified'
                    )
                })
            })
            .then(function (verification) {
                if (!verification.verified) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.VERIFICATION_FAILED,
                        'Passkey registration could not be verified'
                    )
                }

                const credential = verification.registrationInfo.credential
                const createdAt = self.now().toISOString()

                return self.dataSource
                    .getPasskeysDataStore()
                    .addPasskey({
                        id: credential.id,
                        publicKey: isoBase64URL.fromBuffer(
                            credential.publicKey
                        ),
                        counter: credential.counter,
                        transports: credential.transports || [],
                        name: passkeyName,
                        createdAt,
                    })
                    .then(function () {
                        return {
                            id: credential.id,
                            name: passkeyName,
                            createdAt,
                        }
                    })
            })
    }

    /**
     * The challenge is bound to a random login session id, which the route
     * hands to the browser in an httpOnly cookie.
     */
    getAuthenticationOptions(): Promise<{
        sessionId: string
        options: PublicKeyCredentialRequestOptionsJSON
    }> {
        const self = this
        return Promise.resolve()
            .then(function () {
                // empty allowCredentials: discoverable passkey, no password or username step
                return generateAuthenticationOptions({
                    rpID: self.getRelyingParty().rpID,
                    timeout: PASSKEY_CHALLENGE_TTL_MS,
                    userVerification: 'required',
                })
            })
            .then(function (options) {
                const sessionId = randomBytes(32).toString('base64url')
                if (
                    !self
                        .storeFor('authentication')
                        .add(sessionId, options.challenge, 'authentication')
                ) {
                    throw tooManyPendingError()
                }
                return { sessionId, options }
            })
    }

    /**
     * Resolves only when the assertion is valid.
     * - missing/expired login session: VERIFICATION_FAILED (not a guess, no back-off)
     * - unknown credential or bad signature: STATUS_WRONG_PASSWORD (counts towards back-off)
     */
    verifyAuthentication(
        sessionId: string,
        response: AuthenticationResponseJSON
    ): Promise<void> {
        const self = this
        const passkeysDataStore = self.dataSource.getPasskeysDataStore()
        const relyingParty = self.getRelyingParty()
        const invalidCreds = () =>
            ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_WRONG_PASSWORD,
                INVALID_CREDS_ERROR
            )

        let challenge = ''

        return Promise.resolve()
            .then(function () {
                // consume first: the session is spent even if anything below fails
                const expectedChallenge = self
                    .storeFor('authentication')
                    .consume(`${sessionId || ''}`, 'authentication')
                challenge = extractChallenge(response?.response?.clientDataJSON)

                if (!expectedChallenge || challenge !== expectedChallenge) {
                    throw ApiStatusCodes.createError(
                        ApiStatusCodes.VERIFICATION_FAILED,
                        'Passkey login session expired. Try again.'
                    )
                }

                return Promise.all([
                    passkeysDataStore.getPasskeyById(`${response.id || ''}`),
                    passkeysDataStore.getOrCreateUserId(),
                ])
            })
            .then(function ([passkey, userId]) {
                const userHandle = response.response.userHandle
                if (!passkey || (userHandle && userHandle !== userId)) {
                    throw invalidCreds()
                }

                return verifyAuthenticationResponse({
                    response,
                    expectedChallenge: challenge,
                    expectedOrigin: relyingParty.origins,
                    expectedRPID: relyingParty.rpID,
                    credential: {
                        id: passkey.id,
                        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
                        counter: passkey.counter,
                        transports: passkey.transports,
                    },
                    requireUserVerification: true,
                })
                    .catch(function (err) {
                        Logger.e(err)
                        throw invalidCreds()
                    })
                    .then(function (verification) {
                        if (!verification.verified) {
                            throw invalidCreds()
                        }
                        return passkeysDataStore.updatePasskeyUsage(
                            passkey.id,
                            verification.authenticationInfo.newCounter,
                            self.now().toISOString()
                        )
                    })
            })
    }

    getPasskeys(): Promise<IPasskeySummary[]> {
        return this.dataSource
            .getPasskeysDataStore()
            .getAllPasskeys()
            .then(function (passkeys) {
                return passkeys.map((it) => ({
                    id: it.id,
                    name: it.name,
                    createdAt: it.createdAt,
                    lastUsedAt: it.lastUsedAt,
                }))
            })
    }

    deletePasskey(passkeyId: string) {
        return this.dataSource
            .getPasskeysDataStore()
            .deletePasskey(`${passkeyId || ''}`)
    }
}

export default PasskeyManager
