import { createHash, generateKeyPairSync, KeyObject, sign } from 'crypto'
import express = require('express')
import cookieParser = require('cookie-parser')
import { AddressInfo } from 'net'
import { isoBase64URL, isoCBOR } from '@simplewebauthn/server/helpers'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import PasskeysDataStore from '../src/datastore/PasskeysDataStore'
import Authenticator from '../src/user/Authenticator'
import PasskeyManager, {
    PASSKEY_CHALLENGE_TTL_MS,
    PasskeyChallengeStore,
    resolvePasskeyRelyingParty,
} from '../src/user/PasskeyManager'

// jest.mock is hoisted; the fake data source is swapped per test through this holder
const dataStoreHolder: { current: unknown } = { current: undefined }
jest.mock('../src/datastore/DataStoreProvider', () => ({
    __esModule: true,
    default: { getDataStore: () => dataStoreHolder.current },
}))

const LoginRouter = require('../src/routes/login/LoginRouter').default
const UserRouter = require('../src/routes/user/UserRouter').default

const ROOT_DOMAIN = 'example.com'
const RP_ID = 'captain.example.com'
const ORIGIN = 'https://captain.example.com'

Authenticator.setMainSalt('passkey-test-salt')

class MemoryConfigStore {
    private values: Record<string, unknown> = {}
    get(key: string) {
        return this.values[key]
    }
    set(key: string, value: unknown) {
        this.values[key] = JSON.parse(JSON.stringify(value))
    }
}

function createDataSource() {
    const passkeysDataStore = new PasskeysDataStore(
        new MemoryConfigStore() as any
    )
    return {
        getRootDomain: () => ROOT_DOMAIN,
        getPasskeysDataStore: () => passkeysDataStore,
    }
}

function sha256(data: Uint8Array) {
    return new Uint8Array(createHash('sha256').update(data).digest())
}

function concat(...parts: Uint8Array[]) {
    return new Uint8Array(Buffer.concat(parts.map((it) => Buffer.from(it))))
}

function uint32(value: number) {
    const buffer = Buffer.alloc(4)
    buffer.writeUInt32BE(value)
    return new Uint8Array(buffer)
}

function clientData(type: string, challenge: string, origin = ORIGIN) {
    return isoBase64URL.fromUTF8String(
        JSON.stringify({ type, challenge, origin, crossOrigin: false })
    )
}

/**
 * Minimal software authenticator (ES256, "none" attestation) so the real
 * @simplewebauthn/server verification runs in the tests.
 */
class SoftwareAuthenticator {
    readonly credentialId = new Uint8Array(
        createHash('sha256').update(`${Math.random()}`).digest()
    )
    private privateKey: KeyObject
    private publicKey: KeyObject
    private signCount = 0

    constructor(private rpID = RP_ID) {
        const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' })
        this.privateKey = pair.privateKey
        this.publicKey = pair.publicKey
    }

    get id() {
        return isoBase64URL.fromBuffer(this.credentialId)
    }

    createRegistrationResponse(challenge: string, origin = ORIGIN) {
        const jwk = this.publicKey.export({ format: 'jwk' })
        const cosePublicKey = isoCBOR.encode(
            new Map<number, number | Uint8Array>([
                [1, 2],
                [3, -7],
                [-1, 1],
                [-2, isoBase64URL.toBuffer(`${jwk.x}`)],
                [-3, isoBase64URL.toBuffer(`${jwk.y}`)],
            ])
        )
        const credentialIdLength = new Uint8Array([
            this.credentialId.length >> 8,
            this.credentialId.length & 0xff,
        ])
        const authData = concat(
            sha256(new TextEncoder().encode(this.rpID)),
            new Uint8Array([0x01 | 0x04 | 0x40]), // UP | UV | AT
            uint32(this.signCount),
            new Uint8Array(16), // aaguid
            credentialIdLength,
            this.credentialId,
            cosePublicKey
        )
        const attestationObject = isoCBOR.encode(
            new Map<string, string | Uint8Array | Map<string, string>>([
                ['fmt', 'none'],
                ['attStmt', new Map<string, string>()],
                ['authData', authData],
            ])
        )
        return {
            id: this.id,
            rawId: this.id,
            type: 'public-key' as const,
            response: {
                clientDataJSON: clientData(
                    'webauthn.create',
                    challenge,
                    origin
                ),
                attestationObject: isoBase64URL.fromBuffer(attestationObject),
                transports: ['internal' as const],
            },
            clientExtensionResults: {},
        }
    }

    createAuthenticationResponse(challenge: string, userHandle?: string) {
        this.signCount++
        const authData = concat(
            sha256(new TextEncoder().encode(this.rpID)),
            new Uint8Array([0x01 | 0x04]), // UP | UV
            uint32(this.signCount)
        )
        const clientDataJSON = clientData('webauthn.get', challenge)
        const signature = sign(
            'sha256',
            concat(authData, sha256(isoBase64URL.toBuffer(clientDataJSON))),
            this.privateKey
        )
        return {
            id: this.id,
            rawId: this.id,
            type: 'public-key' as const,
            response: {
                clientDataJSON,
                authenticatorData: isoBase64URL.fromBuffer(authData),
                signature: isoBase64URL.fromBuffer(new Uint8Array(signature)),
                userHandle,
            },
            clientExtensionResults: {},
        }
    }
}

async function registerPasskey(
    manager: PasskeyManager,
    authenticator: SoftwareAuthenticator
) {
    const options = await manager.getRegistrationOptions()
    return manager.verifyRegistration(
        'Mac do Miguel',
        authenticator.createRegistrationResponse(options.challenge)
    )
}

function captainErrorType(promise: Promise<unknown>) {
    return promise.then(
        () => undefined,
        (err) => err.captainErrorType
    )
}

describe('PasskeyChallengeStore', () => {
    test('a challenge can only be used once', () => {
        const store = new PasskeyChallengeStore()
        store.add('session', 'abc', 'authentication')
        expect(store.consume('session', 'authentication')).toBe('abc')
        expect(store.consume('session', 'authentication')).toBeUndefined()
    })

    test('a challenge expires after the TTL', () => {
        let now = 1000
        const store = new PasskeyChallengeStore(() => now)
        store.add('session', 'abc', 'authentication')
        now += PASSKEY_CHALLENGE_TTL_MS
        expect(store.consume('session', 'authentication')).toBeUndefined()
    })

    test('a registration challenge cannot be used to log in', () => {
        const store = new PasskeyChallengeStore()
        store.add('session', 'abc', 'registration')
        expect(store.consume('session', 'authentication')).toBeUndefined()
    })

    test('filling the store does not invalidate a challenge already issued', () => {
        const store = new PasskeyChallengeStore(Date.now, 3)
        expect(store.add('legit', 'legit-challenge', 'authentication')).toBe(
            true
        )
        expect(store.add('attacker-1', 'a1', 'authentication')).toBe(true)
        expect(store.add('attacker-2', 'a2', 'authentication')).toBe(true)
        expect(store.add('attacker-3', 'a3', 'authentication')).toBe(false)
        expect(store.consume('legit', 'authentication')).toBe('legit-challenge')
    })
})

describe('resolvePasskeyRelyingParty', () => {
    test('defaults to the captain dashboard host', () => {
        expect(resolvePasskeyRelyingParty(ROOT_DOMAIN)).toEqual({
            rpID: RP_ID,
            origins: [ORIGIN],
        })
    })
})

describe('PasskeyManager', () => {
    test('registers a passkey and logs in with it', async () => {
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore()
        )
        const authenticator = new SoftwareAuthenticator()

        const registered = await registerPasskey(manager, authenticator)
        expect(registered.name).toBe('Mac do Miguel')

        const { sessionId, options } = await manager.getAuthenticationOptions()
        expect(options.rpId).toBe(RP_ID)
        expect(options.userVerification).toBe('required')

        await manager.verifyAuthentication(
            sessionId,
            authenticator.createAuthenticationResponse(options.challenge)
        )

        const passkeys = await manager.getPasskeys()
        expect(passkeys).toHaveLength(1)
        expect(passkeys[0].lastUsedAt).toBeDefined()
        expect(Object.keys(passkeys[0]).sort()).toEqual(
            ['createdAt', 'id', 'lastUsedAt', 'name'].sort()
        )
    })

    test('rejects an invalid signature', async () => {
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore()
        )
        const authenticator = new SoftwareAuthenticator()
        await registerPasskey(manager, authenticator)

        const { sessionId, options } = await manager.getAuthenticationOptions()
        const response = authenticator.createAuthenticationResponse(
            options.challenge
        )
        const signature = isoBase64URL.toBuffer(response.response.signature)
        signature[signature.length - 1] ^= 0xff
        response.response.signature = isoBase64URL.fromBuffer(signature)

        expect(
            await captainErrorType(
                manager.verifyAuthentication(sessionId, response)
            )
        ).toBe(ApiStatusCodes.STATUS_WRONG_PASSWORD)
    })

    test('rejects a passkey that was never registered', async () => {
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore()
        )
        await registerPasskey(manager, new SoftwareAuthenticator())

        const { sessionId, options } = await manager.getAuthenticationOptions()
        const stranger = new SoftwareAuthenticator()
        expect(
            await captainErrorType(
                manager.verifyAuthentication(
                    sessionId,
                    stranger.createAuthenticationResponse(options.challenge)
                )
            )
        ).toBe(ApiStatusCodes.STATUS_WRONG_PASSWORD)
    })

    test('a valid assertion cannot be replayed', async () => {
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore()
        )
        const authenticator = new SoftwareAuthenticator()
        await registerPasskey(manager, authenticator)

        const { sessionId, options } = await manager.getAuthenticationOptions()
        const response = authenticator.createAuthenticationResponse(
            options.challenge
        )
        await manager.verifyAuthentication(sessionId, response)

        expect(
            await captainErrorType(
                manager.verifyAuthentication(sessionId, response)
            )
        ).toBe(ApiStatusCodes.VERIFICATION_FAILED)
    })

    test('rejects an expired challenge without counting it as a wrong credential', async () => {
        let now = 1000
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore(() => now)
        )
        const authenticator = new SoftwareAuthenticator()
        await registerPasskey(manager, authenticator)

        const { sessionId, options } = await manager.getAuthenticationOptions()
        now += PASSKEY_CHALLENGE_TTL_MS + 1

        expect(
            await captainErrorType(
                manager.verifyAuthentication(
                    sessionId,
                    authenticator.createAuthenticationResponse(
                        options.challenge
                    )
                )
            )
        ).toBe(ApiStatusCodes.VERIFICATION_FAILED)
    })

    test('rejects a registration from another origin', async () => {
        const manager = new PasskeyManager(
            createDataSource(),
            new PasskeyChallengeStore()
        )
        const options = await manager.getRegistrationOptions()
        const response = new SoftwareAuthenticator().createRegistrationResponse(
            options.challenge,
            'https://evil.example.com'
        )

        expect(
            await captainErrorType(manager.verifyRegistration('evil', response))
        ).toBe(ApiStatusCodes.VERIFICATION_FAILED)
        expect(await manager.getPasskeys()).toHaveLength(0)
    })
})

describe('passkey routes', () => {
    let server: ReturnType<express.Express['listen']>
    let baseUrl = ''
    let otpEnabled = false
    let clientIpCounter = 0

    beforeAll((done) => {
        const app = express()
        app.use(express.json())
        app.use(cookieParser())
        app.use(function (req, res, next) {
            res.locals.namespace = 'captain'
            res.locals.userManagerForLoginOnly = {
                otpAuthenticator: {
                    is2FactorEnabled: () => Promise.resolve(otpEnabled),
                    isOtpTokenValid: () => Promise.resolve(!otpEnabled),
                },
                eventLogger: { trackEvent: jest.fn() },
            }
            next()
        })
        app.use('/login/', LoginRouter)
        app.use('/user/', UserRouter)
        server = app.listen(0, '127.0.0.1', () => {
            baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
            done()
        })
    })

    afterAll((done) => {
        server.close(() => done())
    })

    // each test gets its own client IP so the per-IP options limit stays independent
    function newClientIp() {
        clientIpCounter++
        return `203.0.113.${clientIpCounter}`
    }

    function postRaw(path: string, body: unknown, headers = {}) {
        return fetch(baseUrl + path, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...headers },
            body: JSON.stringify(body),
        })
    }

    function post(path: string, body: unknown, headers = {}) {
        return postRaw(path, body, headers).then((it) => it.json())
    }

    function cookieValue(response: Response, name: string) {
        const cookie = `${response.headers.get('set-cookie') || ''}`
            .split(/,(?=\s*\w+=)/)
            .find((it) => it.trim().startsWith(`${name}=`))
        return cookie
            ? decodeURIComponent(
                  cookie.split(';')[0].split('=').slice(1).join('=')
              )
            : ''
    }

    async function startPasskeyLogin(ip: string) {
        const response = await postRaw(
            '/login/passkey/options/',
            {},
            { 'x-real-ip': ip }
        )
        const body = await response.json()
        const setCookie = `${response.headers.get('set-cookie') || ''}`
        return {
            body,
            setCookie,
            cookie: `captainPasskeyLogin=${cookieValue(response, 'captainPasskeyLogin')}`,
        }
    }

    async function setUpPasskey() {
        const dataSource = createDataSource()
        dataStoreHolder.current = dataSource
        const authenticator = new SoftwareAuthenticator()
        await registerPasskey(new PasskeyManager(dataSource), authenticator)
        return authenticator
    }

    test('registration routes require a logged-in user', async () => {
        dataStoreHolder.current = createDataSource()

        const withoutToken = await post('/user/passkeys/register/options/', {})
        expect(withoutToken.status).toBe(
            ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID
        )
        expect(withoutToken.data).toEqual({})

        const forgedToken = await post(
            '/user/passkeys/register/verify/',
            { name: 'x', response: {} },
            { 'x-captain-auth': 'not-a-token' }
        )
        expect(forgedToken.status).toBe(
            ApiStatusCodes.STATUS_AUTH_TOKEN_INVALID
        )
    })

    test('options sets a short-lived httpOnly, Secure, SameSite=Strict session cookie', async () => {
        await setUpPasskey()
        const { body, setCookie } = await startPasskeyLogin(newClientIp())

        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
        expect(setCookie).toMatch(/captainPasskeyLogin=[A-Za-z0-9_-]{43}/)
        expect(setCookie).toMatch(/HttpOnly/i)
        expect(setCookie).toMatch(/Secure/i)
        expect(setCookie).toMatch(/SameSite=Strict/i)
        expect(setCookie).toMatch(/Max-Age=300/i)
    })

    test('passkey login issues the same valid tokens as password login', async () => {
        const authenticator = await setUpPasskey()
        const login = await startPasskeyLogin(newClientIp())

        const response = await postRaw(
            '/login/passkey/verify/',
            {
                response: authenticator.createAuthenticationResponse(
                    login.body.data.challenge
                ),
            },
            { cookie: login.cookie }
        )
        const body = await response.json()
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)

        const captainAuthenticator = Authenticator.getAuthenticator('captain')
        const decoded = await captainAuthenticator.decodeAuthToken(
            body.data.token
        )
        expect(decoded.namespace).toBe('captain')

        const cookieToken = cookieValue(response, 'captainCookieAuth')
        expect(
            (await captainAuthenticator.decodeAuthTokenFromCookies(cookieToken))
                .namespace
        ).toBe('captain')
    })

    test('an assertion without the matching login session cookie is refused', async () => {
        const authenticator = await setUpPasskey()
        const login = await startPasskeyLogin(newClientIp())

        const body = await post('/login/passkey/verify/', {
            response: authenticator.createAuthenticationResponse(
                login.body.data.challenge
            ),
        })
        expect(body.status).toBe(ApiStatusCodes.VERIFICATION_FAILED)
    })

    test('passkey login still requires OTP when 2FA is enabled', async () => {
        const authenticator = await setUpPasskey()

        otpEnabled = true
        try {
            const login = await startPasskeyLogin(newClientIp())
            const body = await post(
                '/login/passkey/verify/',
                {
                    response: authenticator.createAuthenticationResponse(
                        login.body.data.challenge
                    ),
                },
                { cookie: login.cookie }
            )
            expect(body.status).toBe(ApiStatusCodes.STATUS_ERROR_OTP_REQUIRED)
            expect(body.data).toEqual({})
        } finally {
            otpEnabled = false
        }
    })

    test('options is rate limited per client IP', async () => {
        await setUpPasskey()
        const ip = newClientIp()
        for (let i = 0; i < 10; i++) {
            expect((await startPasskeyLogin(ip)).body.status).toBe(
                ApiStatusCodes.STATUS_OK
            )
        }
        expect((await startPasskeyLogin(ip)).body.status).toBe(
            ApiStatusCodes.STATUS_PASSWORD_BACK_OFF
        )
        // another client is not affected
        expect((await startPasskeyLogin(newClientIp())).body.status).toBe(
            ApiStatusCodes.STATUS_OK
        )
    })

    test('missing or expired login sessions do not count towards the login back-off', async () => {
        const authenticator = await setUpPasskey()

        for (let i = 0; i < 6; i++) {
            const body = await post('/login/passkey/verify/', {
                response: authenticator.createAuthenticationResponse(
                    'no-session-challenge'
                ),
            })
            expect(body.status).toBe(ApiStatusCodes.VERIFICATION_FAILED)
        }

        const login = await startPasskeyLogin(newClientIp())
        expect(login.body.status).toBe(ApiStatusCodes.STATUS_OK)
        const body = await post(
            '/login/passkey/verify/',
            {
                response: authenticator.createAuthenticationResponse(
                    login.body.data.challenge
                ),
            },
            { cookie: login.cookie }
        )
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
    })

    // keep last: it leaves the shared 30 s login back-off engaged
    test('invalid signatures still count towards the login back-off', async () => {
        const authenticator = await setUpPasskey()

        for (let i = 0; i < 5; i++) {
            const login = await startPasskeyLogin(newClientIp())
            const response = authenticator.createAuthenticationResponse(
                login.body.data.challenge
            )
            const signature = isoBase64URL.toBuffer(response.response.signature)
            signature[signature.length - 1] ^= 0xff
            response.response.signature = isoBase64URL.fromBuffer(signature)

            const body = await post(
                '/login/passkey/verify/',
                { response },
                { cookie: login.cookie }
            )
            expect(body.status).toBe(ApiStatusCodes.STATUS_WRONG_PASSWORD)
        }

        expect((await startPasskeyLogin(newClientIp())).body.status).toBe(
            ApiStatusCodes.STATUS_PASSWORD_BACK_OFF
        )
    })
})
