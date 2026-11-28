import axios from 'axios'
import express = require('express')
import * as http from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'
import oneClickRouter from '../src/routes/user/oneclick/OneClickAppRouter'
import OneClickAppDeployManager from '../src/user/oneclick/OneClickAppDeployManager'
import { OneClickDeploymentJobRegistry } from '../src/user/oneclick/OneClickDeploymentJobRegistry'
import Logger from '../src/utils/Logger'

const OFFICIAL_BASE_URL = 'https://oneclickapps.caprover.com'

describe('one-click deploy route', () => {
    const template: IOneClickTemplate = {
        captainVersion: 4,
        services: {},
        caproverOneClickApp: {
            displayName: 'Test App',
            instructions: {
                start: '',
                end: '',
            },
            variables: [],
        },
    }

    let server: Server
    let baseUrl: string
    let registry: {
        createJob: jest.Mock
        updateJobProgress: jest.Mock
        removeJob: jest.Mock
    }
    let startDeployProcess: jest.SpyInstance

    beforeEach(async () => {
        registry = {
            createJob: jest.fn(() => 'job-1'),
            updateJobProgress: jest.fn(),
            removeJob: jest.fn(),
        }

        jest.spyOn(
            OneClickDeploymentJobRegistry,
            'getInstance'
        ).mockReturnValue(registry as any)
        startDeployProcess = jest
            .spyOn(OneClickAppDeployManager.prototype, 'startDeployProcess')
            .mockImplementation(() => undefined)
        jest.spyOn(Logger, 'e').mockImplementation(() => undefined)

        const app = express()
        app.use(express.json())
        app.use(function (_req, res, next) {
            res.locals.user = {
                dataStore: {},
                serviceManager: {},
                userManager: {
                    eventLogger: {
                        trackEvent: jest.fn(),
                    },
                },
            }
            next()
        })
        app.use('/user/oneclick', oneClickRouter)

        server = await new Promise<Server>((resolve) => {
            const listeningServer = app.listen(0, () =>
                resolve(listeningServer)
            )
        })

        const address = server.address() as AddressInfo
        baseUrl = `http://127.0.0.1:${address.port}`
    })

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error)
                    return
                }
                resolve()
            })
        })
        jest.restoreAllMocks()
    })

    async function postDeploy(body: Record<string, unknown>) {
        return fetch(`${baseUrl}/user/oneclick/deploy`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(body),
        })
    }

    test('defaults omitted values to an empty array', async () => {
        const response = await postDeploy({
            template,
            templateName: 'TEMPLATE_ONE_CLICK',
        })
        const body = (await response.json()) as {
            status: number
            data: { jobId: string }
        }

        expect(response.status).toBe(200)
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
        expect(body.data.jobId).toBe('job-1')
        expect(startDeployProcess).toHaveBeenCalledWith(
            template,
            [],
            'TEMPLATE_ONE_CLICK'
        )
        expect(registry.createJob).toHaveBeenCalledTimes(1)
        expect(registry.removeJob).not.toHaveBeenCalled()
    })

    test('forwards DOCKER_COMPOSE templateName so direct Compose imports use standard semantics', async () => {
        const response = await postDeploy({
            template,
            values: [],
            templateName: 'DOCKER_COMPOSE',
        })
        const body = (await response.json()) as {
            status: number
            data: { jobId: string }
        }

        expect(response.status).toBe(200)
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
        expect(body.data.jobId).toBe('job-1')
        expect(startDeployProcess).toHaveBeenCalledWith(
            template,
            [],
            'DOCKER_COMPOSE'
        )
    })

    test('rejects non-array values before creating a job', async () => {
        const response = await postDeploy({
            template,
            values: {},
            templateName: 'TEMPLATE_ONE_CLICK',
        })
        const body = (await response.json()) as {
            status: number
            description: string
        }

        expect(response.status).toBe(200)
        expect(body.status).toBe(ApiStatusCodes.ILLEGAL_PARAMETER)
        expect(body.description).toBe('Values must be an array')
        expect(registry.createJob).not.toHaveBeenCalled()
        expect(startDeployProcess).not.toHaveBeenCalled()
    })

    test('removes a newly-created job when deployment startup throws', async () => {
        startDeployProcess.mockImplementationOnce(() => {
            throw new Error('startup failed')
        })

        const response = await postDeploy({
            template,
            values: [],
            templateName: 'TEMPLATE_ONE_CLICK',
        })

        expect(response.status).toBe(500)
        await response.text()
        expect(registry.createJob).toHaveBeenCalledTimes(1)
        expect(registry.removeJob).toHaveBeenCalledWith('job-1')
    })
})

describe('one-click catalog version resolution routes', () => {
    let server: Server
    let baseUrl: string
    let storedUrls: string[]
    let openRepos: (() => Promise<void>)[]

    const jsonGet = async (path: string) => {
        const res = await fetch(`${baseUrl}/user/oneclick${path}`)
        return { httpStatus: res.status, body: (await res.json()) as any }
    }
    const jsonPost = async (path: string, payload: unknown) => {
        const res = await fetch(`${baseUrl}/user/oneclick${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        })
        return { httpStatus: res.status, body: (await res.json()) as any }
    }

    async function startRepo(
        routes: Record<string, { status?: number; body: unknown }>
    ) {
        const requests: string[] = []
        const repoServer = http.createServer((req, res) => {
            const path = req.url || ''
            requests.push(path)
            const entry = routes[path]
            if (!entry) {
                res.writeHead(404).end()
                return
            }
            const isString = typeof entry.body === 'string'
            res.writeHead(entry.status ?? 200, {
                'content-type': isString ? 'text/html' : 'application/json',
            })
            res.end(isString ? entry.body : JSON.stringify(entry.body))
        })
        await new Promise<void>((resolve) =>
            repoServer.listen(0, '127.0.0.1', () => resolve())
        )
        const { port } = repoServer.address() as AddressInfo
        openRepos.push(
            () =>
                new Promise<void>((resolve, reject) =>
                    repoServer.close((err) => (err ? reject(err) : resolve()))
                )
        )
        return { url: `http://127.0.0.1:${port}`, requests }
    }

    function stubOfficialV5(oneClickApps: unknown[] = []) {
        const realGet = axios.get.bind(axios)
        jest.spyOn(axios, 'get').mockImplementation((url, config) =>
            url === `${OFFICIAL_BASE_URL}/v5/list`
                ? Promise.resolve({ data: { oneClickApps } } as any)
                : realGet(url, config)
        )
    }

    beforeEach(async () => {
        storedUrls = []
        openRepos = []
        const dataStore = {
            getAllOneClickBaseUrls: jest.fn(async () => [...storedUrls]),
            insertOneClickBaseUrl: jest.fn(async (url: string) => {
                storedUrls.push(url)
            }),
            deleteOneClickBaseUrl: jest.fn(async (url: string) => {
                storedUrls = storedUrls.filter((u) => u !== url)
            }),
        }
        jest.spyOn(Logger, 'e').mockImplementation(() => undefined)
        jest.spyOn(Logger, 'd').mockImplementation(() => undefined)

        const app = express()
        app.use(express.json())
        app.use((_req, res, next) => {
            res.locals.user = {
                dataStore,
                serviceManager: {},
                userManager: { eventLogger: { trackEvent: jest.fn() } },
            }
            next()
        })
        app.use('/user/oneclick', oneClickRouter)
        server = await new Promise<Server>((resolve) => {
            const listening = app.listen(0, () => resolve(listening))
        })
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    })

    afterEach(async () => {
        await Promise.all(openRepos.map((close) => close()))
        await new Promise<void>((resolve, reject) =>
            server.close((err) => (err ? reject(err) : resolve()))
        )
        jest.restoreAllMocks()
    })

    test('prefers v5 over v4 without duplicates and resolves v5 relative and absolute logos', async () => {
        const repo = await startRepo({
            '/v5/list': {
                body: {
                    oneClickApps: [
                        {
                            name: 'redis',
                            displayName: 'Redis v5',
                            description: 'v5',
                            logoUrl: 'redis.png',
                            isOfficial: true,
                        },
                        {
                            name: 'ext',
                            displayName: 'External Logo',
                            description: 'abs',
                            logoUrl: 'https://cdn.example.test/logo.png',
                        },
                    ],
                },
            },
            '/v4/list': {
                body: {
                    oneClickApps: [
                        {
                            name: 'redis',
                            displayName: 'Redis v4',
                            description: 'v4',
                            logoUrl: 'redis.png',
                        },
                    ],
                },
            },
        })
        stubOfficialV5([
            {
                name: 'official-app',
                displayName: 'Official',
                description: 'official v5',
                logoUrl: 'official.png',
                isOfficial: true,
            },
        ])
        storedUrls.push(repo.url)

        const { body } = await jsonGet('/template/list')
        expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
        expect(repo.requests).toEqual(['/v5/list'])
        expect(body.data.oneClickApps).toEqual([
            {
                baseUrl: repo.url,
                name: 'redis',
                displayName: 'Redis v5',
                isOfficial: true,
                description: 'v5',
                logoUrl: `${repo.url}/v5/logos/redis.png`,
            },
            {
                baseUrl: repo.url,
                name: 'ext',
                displayName: 'External Logo',
                isOfficial: false,
                description: 'abs',
                logoUrl: 'https://cdn.example.test/logo.png',
            },
            {
                baseUrl: OFFICIAL_BASE_URL,
                name: 'official-app',
                displayName: 'Official',
                isOfficial: true,
                description: 'official v5',
                logoUrl: `${OFFICIAL_BASE_URL}/v5/logos/official.png`,
            },
        ])
    })

    test('supports v4-only fallback and v5-only repos consistently across insert, list, and app detail', async () => {
        const v4Repo = await startRepo({
            '/v4/list': {
                body: {
                    oneClickApps: [
                        {
                            name: 'legacy',
                            displayName: 'Legacy',
                            description: 'v4 only',
                            logoUrl: 'legacy.png',
                        },
                    ],
                },
            },
            '/v4/apps/legacy': {
                body: {
                    captainVersion: 4,
                    services: { $$cap_appname: { image: 'nginx' } },
                },
            },
        })
        const v5Repo = await startRepo({
            '/v5/list': {
                body: {
                    oneClickApps: [
                        {
                            name: 'modern',
                            displayName: 'Modern',
                            description: 'v5 only',
                            logoUrl: 'modern.png',
                        },
                    ],
                },
            },
            '/v5/apps/modern': {
                body: {
                    captainVersion: 5,
                    services: {
                        $$cap_appname: {
                            image: 'alpine',
                            entrypoint: ['/bin/sh', '-ec'],
                        },
                    },
                },
            },
        })
        stubOfficialV5()

        expect(
            (
                await jsonPost('/repositories/insert', {
                    repositoryUrl: `${v4Repo.url}/`,
                })
            ).body.status
        ).toBe(ApiStatusCodes.STATUS_OK)
        expect(
            (
                await jsonPost('/repositories/insert', {
                    repositoryUrl: v5Repo.url,
                })
            ).body.status
        ).toBe(ApiStatusCodes.STATUS_OK)

        const list = (await jsonGet('/template/list')).body
        expect(list.data.oneClickApps.map((a: any) => a.logoUrl)).toEqual([
            `${v4Repo.url}/v4/logos/legacy.png`,
            `${v5Repo.url}/v5/logos/modern.png`,
        ])

        const v4App = (
            await jsonGet(
                `/template/app?baseDomain=${encodeURIComponent(v4Repo.url)}&appName=legacy`
            )
        ).body
        const v5App = (
            await jsonGet(
                `/template/app?baseDomain=${encodeURIComponent(v5Repo.url)}&appName=modern`
            )
        ).body
        expect(v4App.data.appTemplate.captainVersion).toBe(4)
        expect(v5App.data.appTemplate.captainVersion).toBe(5)
        expect(v4Repo.requests).toEqual([
            '/v5/list',
            '/v4/list',
            '/v5/list',
            '/v4/list',
            '/v5/apps/legacy',
            '/v4/apps/legacy',
        ])
        expect(v5Repo.requests).toEqual([
            '/v5/list',
            '/v5/list',
            '/v5/apps/modern',
        ])
    })

    test.each([
        ['401 unauthorized', 401, 'Unauthorized'],
        ['403 forbidden', 403, 'Forbidden'],
        ['500 server error', 500, 'Internal error'],
        ['malformed 200 JSON', 200, { unexpected: true }],
        ['malformed 200 HTML', 200, '<html>not found</html>'],
    ])(
        'does not fall back to v4 when v5 returns %s across insert, list, and app detail',
        async (_label, status, v5Body) => {
            const repo = await startRepo({
                '/v5/list': { status, body: v5Body },
                '/v5/apps/test-app': { status, body: v5Body },
                '/v4/list': {
                    body: { oneClickApps: [{ name: 'should-not-use' }] },
                },
                '/v4/apps/test-app': {
                    body: { captainVersion: 4, services: { a: {} } },
                },
            })
            stubOfficialV5()

            const insert = await jsonPost('/repositories/insert', {
                repositoryUrl: repo.url,
            })
            expect(insert.body.status).toBe(ApiStatusCodes.STATUS_ERROR_GENERIC)
            expect(storedUrls).toEqual([])

            storedUrls.push(repo.url)
            const list = await jsonGet('/template/list')
            expect(list.body.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(list.body.data.oneClickApps).toEqual([])

            const appRes = await fetch(
                `${baseUrl}/user/oneclick/template/app?baseDomain=${encodeURIComponent(repo.url)}&appName=test-app`
            )
            expect(appRes.status).toBe(500)
            await appRes.text()

            expect(repo.requests).toEqual([
                '/v5/list',
                '/v5/list',
                '/v5/apps/test-app',
            ])
        }
    )

    test('preserves error handling when repository is unavailable on both v5 and v4', async () => {
        const repo = await startRepo({})
        const insert = await jsonPost('/repositories/insert', {
            repositoryUrl: repo.url,
        })
        expect(insert.body.status).toBe(ApiStatusCodes.STATUS_ERROR_GENERIC)
        expect(insert.body.description).toBe(
            `Could not fetch app lists from ${repo.url}`
        )
        expect(repo.requests).toEqual(['/v5/list', '/v4/list'])
        expect(storedUrls).toEqual([])
    })
})
