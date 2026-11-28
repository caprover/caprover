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
    let dataStore: {
        getAllOneClickBaseUrls: jest.Mock
        insertOneClickBaseUrl: jest.Mock
        deleteOneClickBaseUrl: jest.Mock
    }

    async function startMockRepoServer(
        handler: (req: http.IncomingMessage, res: http.ServerResponse) => void
    ) {
        const repoServer = http.createServer(handler)
        await new Promise<void>((resolve) => {
            repoServer.listen(0, '127.0.0.1', () => resolve())
        })
        const address = repoServer.address() as AddressInfo
        return {
            url: `http://127.0.0.1:${address.port}`,
            close: () =>
                new Promise<void>((resolve, reject) => {
                    repoServer.close((err) => (err ? reject(err) : resolve()))
                }),
        }
    }

    beforeEach(async () => {
        storedUrls = []
        dataStore = {
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
        app.use(function (_req, res, next) {
            res.locals.user = {
                dataStore,
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
            server.close((error) => (error ? reject(error) : resolve()))
        })
        jest.restoreAllMocks()
    })

    test('prefers v5 over v4 without duplicates and resolves v5 relative logo URLs', async () => {
        const requests: string[] = []
        const repo = await startMockRepoServer((req, res) => {
            requests.push(req.url || '')
            if (req.url === '/v5/list') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        oneClickApps: [
                            {
                                name: 'redis',
                                displayName: 'Redis v5',
                                description: 'v5 catalog app',
                                logoUrl: 'redis.png',
                                isOfficial: true,
                            },
                            {
                                name: 'custom-logo',
                                displayName: 'Absolute Logo App',
                                description: 'absolute logo',
                                logoUrl: 'https://cdn.example.test/logo.png',
                            },
                        ],
                    })
                )
                return
            }
            if (req.url === '/v4/list') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        oneClickApps: [
                            {
                                name: 'redis',
                                displayName: 'Redis v4',
                                description: 'v4 catalog app',
                                logoUrl: 'redis.png',
                            },
                        ],
                    })
                )
                return
            }
            res.writeHead(404).end()
        })

        const realAxiosGet = axios.get.bind(axios)
        jest.spyOn(axios, 'get').mockImplementation((url, config) => {
            if (url === `${OFFICIAL_BASE_URL}/v5/list`) {
                return Promise.resolve({
                    data: {
                        oneClickApps: [
                            {
                                name: 'official-app',
                                displayName: 'Official App',
                                description: 'From official v5',
                                logoUrl: 'official.png',
                                isOfficial: true,
                            },
                        ],
                    },
                } as any)
            }
            return realAxiosGet(url, config)
        })

        try {
            storedUrls.push(repo.url)
            const response = await fetch(
                `${baseUrl}/user/oneclick/template/list`
            )
            const body = (await response.json()) as {
                status: number
                data: { oneClickApps: any[] }
            }

            expect(body.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(requests).toEqual(['/v5/list'])
            expect(body.data.oneClickApps).toEqual([
                {
                    baseUrl: repo.url,
                    name: 'redis',
                    displayName: 'Redis v5',
                    isOfficial: true,
                    description: 'v5 catalog app',
                    logoUrl: `${repo.url}/v5/logos/redis.png`,
                },
                {
                    baseUrl: repo.url,
                    name: 'custom-logo',
                    displayName: 'Absolute Logo App',
                    isOfficial: false,
                    description: 'absolute logo',
                    logoUrl: 'https://cdn.example.test/logo.png',
                },
                {
                    baseUrl: OFFICIAL_BASE_URL,
                    name: 'official-app',
                    displayName: 'Official App',
                    isOfficial: true,
                    description: 'From official v5',
                    logoUrl: `${OFFICIAL_BASE_URL}/v5/logos/official.png`,
                },
            ])
        } finally {
            await repo.close()
        }
    })

    test('falls back to v4 for v4-only repositories across insert, list, and app detail', async () => {
        const requests: string[] = []
        const repo = await startMockRepoServer((req, res) => {
            requests.push(req.url || '')
            if (req.url === '/v4/list') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        oneClickApps: [
                            {
                                name: 'legacy-app',
                                displayName: 'Legacy App',
                                description: 'Only in v4',
                                logoUrl: 'legacy.png',
                            },
                        ],
                    })
                )
                return
            }
            if (req.url === '/v4/apps/legacy-app') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        captainVersion: 4,
                        services: { $$cap_appname: { image: 'nginx' } },
                    })
                )
                return
            }
            res.writeHead(404).end()
        })

        const realAxiosGet = axios.get.bind(axios)
        jest.spyOn(axios, 'get').mockImplementation((url, config) => {
            if (url === `${OFFICIAL_BASE_URL}/v5/list`) {
                return Promise.resolve({ data: { oneClickApps: [] } } as any)
            }
            return realAxiosGet(url, config)
        })

        try {
            const insertRes = await fetch(
                `${baseUrl}/user/oneclick/repositories/insert`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ repositoryUrl: `${repo.url}/` }),
                }
            )
            const insertBody = (await insertRes.json()) as { status: number }
            expect(insertBody.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(storedUrls).toEqual([repo.url])

            const listRes = await fetch(
                `${baseUrl}/user/oneclick/template/list`
            )
            const listBody = (await listRes.json()) as {
                status: number
                data: { oneClickApps: any[] }
            }
            expect(listBody.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(listBody.data.oneClickApps).toEqual([
                {
                    baseUrl: repo.url,
                    name: 'legacy-app',
                    displayName: 'Legacy App',
                    isOfficial: false,
                    description: 'Only in v4',
                    logoUrl: `${repo.url}/v4/logos/legacy.png`,
                },
            ])

            const appRes = await fetch(
                `${baseUrl}/user/oneclick/template/app?baseDomain=${encodeURIComponent(repo.url)}&appName=legacy-app`
            )
            const appBody = (await appRes.json()) as {
                status: number
                data: { appTemplate: any }
            }
            expect(appBody.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(appBody.data.appTemplate).toEqual({
                captainVersion: 4,
                services: { $$cap_appname: { image: 'nginx' } },
            })
            expect(requests).toEqual([
                '/v5/list',
                '/v4/list',
                '/v5/list',
                '/v4/list',
                '/v5/apps/legacy-app',
                '/v4/apps/legacy-app',
            ])
        } finally {
            await repo.close()
        }
    })

    test('registers v5-only repository and retrieves v5 app template', async () => {
        const requests: string[] = []
        const repo = await startMockRepoServer((req, res) => {
            requests.push(req.url || '')
            if (req.url === '/v5/list') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        oneClickApps: [
                            {
                                name: 'modern-app',
                                displayName: 'Modern App',
                                description: 'Only in v5',
                                logoUrl: 'modern.png',
                            },
                        ],
                    })
                )
                return
            }
            if (req.url === '/v5/apps/modern-app') {
                res.writeHead(200, { 'content-type': 'application/json' })
                res.end(
                    JSON.stringify({
                        captainVersion: 5,
                        services: {
                            $$cap_appname: {
                                image: 'alpine',
                                entrypoint: ['/bin/sh', '-ec'],
                                command: ['echo hi'],
                            },
                        },
                    })
                )
                return
            }
            res.writeHead(404).end()
        })

        try {
            const insertRes = await fetch(
                `${baseUrl}/user/oneclick/repositories/insert`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ repositoryUrl: repo.url }),
                }
            )
            const insertBody = (await insertRes.json()) as { status: number }
            expect(insertBody.status).toBe(ApiStatusCodes.STATUS_OK)

            const appRes = await fetch(
                `${baseUrl}/user/oneclick/template/app?baseDomain=${encodeURIComponent(repo.url)}&appName=modern-app`
            )
            const appBody = (await appRes.json()) as {
                status: number
                data: { appTemplate: any }
            }
            expect(appBody.status).toBe(ApiStatusCodes.STATUS_OK)
            expect(appBody.data.appTemplate.captainVersion).toBe(5)
            expect(requests).toEqual(['/v5/list', '/v5/apps/modern-app'])
        } finally {
            await repo.close()
        }
    })

    test.each([
        ['401 unauthorized', 401, 'Unauthorized'],
        ['403 forbidden', 403, 'Forbidden'],
        ['500 server error', 500, 'Internal error'],
        ['malformed 200 response', 200, '{"unexpected":true}'],
    ])(
        'does not silently fall back to v4 when v5 returns %s',
        async (_label, statusCode, responseText) => {
            const requests: string[] = []
            const repo = await startMockRepoServer((req, res) => {
                requests.push(req.url || '')
                if (req.url?.startsWith('/v5/')) {
                    res.writeHead(statusCode, {
                        'content-type': 'application/json',
                    })
                    res.end(responseText)
                    return
                }
                if (req.url === '/v4/list') {
                    res.writeHead(200, { 'content-type': 'application/json' })
                    res.end(
                        JSON.stringify({
                            oneClickApps: [{ name: 'should-not-use' }],
                        })
                    )
                    return
                }
                if (req.url === '/v4/apps/test-app') {
                    res.writeHead(200, { 'content-type': 'application/json' })
                    res.end(JSON.stringify({ captainVersion: 4 }))
                    return
                }
                res.writeHead(404).end()
            })

            const realAxiosGet = axios.get.bind(axios)
            jest.spyOn(axios, 'get').mockImplementation((url, config) => {
                if (url === `${OFFICIAL_BASE_URL}/v5/list`) {
                    return Promise.resolve({
                        data: { oneClickApps: [] },
                    } as any)
                }
                return realAxiosGet(url, config)
            })

            try {
                const insertRes = await fetch(
                    `${baseUrl}/user/oneclick/repositories/insert`,
                    {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ repositoryUrl: repo.url }),
                    }
                )
                const insertBody = (await insertRes.json()) as {
                    status: number
                    description: string
                }
                expect(insertBody.status).toBe(
                    ApiStatusCodes.STATUS_ERROR_GENERIC
                )
                expect(insertBody.description).toBe(
                    `Could not fetch app lists from ${repo.url}`
                )
                expect(requests).toEqual(['/v5/list'])

                storedUrls.push(repo.url)
                const listRes = await fetch(
                    `${baseUrl}/user/oneclick/template/list`
                )
                const listBody = (await listRes.json()) as {
                    status: number
                    data: { oneClickApps: any[] }
                }
                expect(listBody.status).toBe(ApiStatusCodes.STATUS_OK)
                expect(listBody.data.oneClickApps).toEqual([])
                expect(requests).toEqual(['/v5/list', '/v5/list'])

                if (statusCode !== 200) {
                    const appRes = await fetch(
                        `${baseUrl}/user/oneclick/template/app?baseDomain=${encodeURIComponent(repo.url)}&appName=test-app`
                    )
                    expect(appRes.status).toBe(500)
                    expect(requests).toEqual([
                        '/v5/list',
                        '/v5/list',
                        '/v5/apps/test-app',
                    ])
                }
            } finally {
                await repo.close()
            }
        }
    )

    test('preserves error handling when repository is unavailable', async () => {
        const repo = await startMockRepoServer((_req, res) => {
            res.writeHead(404).end()
        })
        try {
            const insertRes = await fetch(
                `${baseUrl}/user/oneclick/repositories/insert`,
                {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ repositoryUrl: repo.url }),
                }
            )
            const insertBody = (await insertRes.json()) as {
                status: number
                description: string
            }
            expect(insertBody.status).toBe(ApiStatusCodes.STATUS_ERROR_GENERIC)
            expect(insertBody.description).toBe(
                `Could not fetch app lists from ${repo.url}`
            )
            expect(storedUrls).toEqual([])
        } finally {
            await repo.close()
        }
    })
})
