import express = require('express')
import type { StatsFs } from 'fs'
import fs from 'fs/promises'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import type {
    DiskUsageResponse,
    DiskUsageSeverity,
} from '../src/models/DiskUsage'
import type { ServerDockerInfo } from '../src/models/ServerDockerInfo'
import UserRouter from '../src/routes/user/UserRouter'
import Authenticator from '../src/user/Authenticator'
import CaptainManager from '../src/user/system/CaptainManager'
import CaptainConstants from '../src/utils/CaptainConstants'
import Logger from '../src/utils/Logger'

function filesystemStats(overrides: Partial<StatsFs> = {}): StatsFs {
    return {
        type: 0,
        bsize: 4096,
        frsize: 4096,
        blocks: 1000,
        bfree: 200,
        bavail: 200,
        files: 1000,
        ffree: 500,
        ...overrides,
    }
}

function dockerNode(
    overrides: Partial<ServerDockerInfo> = {}
): ServerDockerInfo {
    return {
        nodeId: 'captain-node-id',
        hostname: 'captain-host',
        type: 'manager',
        isLeader: false,
        architecture: 'x86_64',
        operatingSystem: 'linux',
        nanoCpu: 1000000000,
        memoryBytes: 1073741824,
        dockerEngineVersion: '28.0.0',
        ip: '127.0.0.1',
        state: 'ready',
        status: 'active',
        ...overrides,
    }
}

const normalUsage: DiskUsageResponse = {
    coverage: 'captain-node',
    nodes: [
        {
            nodeId: 'captain-node-id',
            hostname: 'captain-host',
            disks: [
                {
                    totalBytes: 4096000,
                    usedBytes: 3276800,
                    availableBytes: 819200,
                    severity: 'normal',
                },
            ],
        },
    ],
}

describe('disk usage', () => {
    let manager: CaptainManager
    let readStats: jest.SpiedFunction<typeof fs.statfs>
    let getNodesInfo: jest.SpiedFunction<CaptainManager['getNodesInfo']>

    beforeEach(() => {
        manager = Object.create(CaptainManager.prototype) as CaptainManager
        jest.spyOn(manager, 'getMyNodeId').mockReturnValue('captain-node-id')
        getNodesInfo = jest.spyOn(manager, 'getNodesInfo').mockResolvedValue([
            dockerNode({
                nodeId: 'other-node-id',
                hostname: 'other-host',
                isLeader: true,
            }),
            dockerNode(),
        ])
        readStats = jest
            .spyOn(fs, 'statfs')
            .mockResolvedValue(filesystemStats())
        jest.spyOn(Logger, 'e').mockImplementation()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('reads the configured host bind mount and returns only the captain node', async () => {
        jest.replaceProperty(
            CaptainConstants,
            'captainBaseDirectory',
            '/custom-captain'
        )

        expect(await manager.getDiskUsage()).toEqual(normalUsage)
        expect(readStats).toHaveBeenCalledWith('/custom-captain')
    })

    test.each<[number, DiskUsageSeverity]>([
        [151, 'normal'],
        [150, 'warning'],
        [51, 'warning'],
        [50, 'critical'],
        [0, 'critical'],
        [-10, 'critical'],
    ])('classifies %i available blocks as %s', async (bavail, severity) => {
        readStats.mockResolvedValue(filesystemStats({ bavail }))

        const data = await manager.getDiskUsage()
        expect(data.nodes[0].disks[0]).toEqual({
            totalBytes: 4096000,
            usedBytes: 3276800,
            availableBytes: Math.max(0, bavail) * 4096,
            severity,
        })
    })

    test.each<Partial<StatsFs>>([
        { bsize: 4096, blocks: 0, bfree: 0, bavail: 0 },
        { bsize: 4096, blocks: 1000, bfree: 1001, bavail: 100 },
        { bsize: 4096, blocks: 1000, bfree: 200, bavail: 201 },
        { bsize: 4096, blocks: NaN, bfree: 200, bavail: 100 },
    ])('rejects invalid capacity statistics: %j', async (stats) => {
        readStats.mockResolvedValue(filesystemStats(stats))
        await expect(manager.getDiskUsage()).rejects.toThrow(
            'Invalid filesystem capacity statistics'
        )
    })

    test('rejects an unknown hosting node', async () => {
        getNodesInfo.mockResolvedValue([])
        await expect(manager.getDiskUsage()).rejects.toThrow(
            'Cannot identify the node hosting CapRover'
        )
    })

    test('keeps reading fresh capacity during Docker failures after identity is known', async () => {
        await manager.getDiskUsage()
        getNodesInfo.mockRejectedValue(new Error('Docker unavailable'))
        readStats.mockResolvedValue(filesystemStats({ bavail: 50 }))

        const data = await manager.getDiskUsage()
        expect(data.nodes[0]).toMatchObject({
            nodeId: 'captain-node-id',
            hostname: 'captain-host',
            disks: [{ availableBytes: 204800, severity: 'critical' }],
        })
        expect(getNodesInfo).toHaveBeenCalledTimes(1)
        expect(readStats).toHaveBeenCalledTimes(2)
    })

    test('retries identity discovery after an initial Docker failure', async () => {
        getNodesInfo.mockRejectedValueOnce(new Error('Docker unavailable'))
        await expect(manager.getDiskUsage()).rejects.toThrow(
            'Docker unavailable'
        )
        expect(await manager.getDiskUsage()).toEqual(normalUsage)
        expect(getNodesInfo).toHaveBeenCalledTimes(2)
    })

    test('refreshes cached identity when the hosting node changes', async () => {
        await manager.getDiskUsage()
        jest.spyOn(manager, 'getMyNodeId').mockReturnValue('new-node-id')
        getNodesInfo.mockResolvedValue([
            dockerNode({ nodeId: 'new-node-id', hostname: 'new-host' }),
        ])

        const data = await manager.getDiskUsage()
        expect(data.nodes[0]).toMatchObject({
            nodeId: 'new-node-id',
            hostname: 'new-host',
        })
        expect(getNodesInfo).toHaveBeenCalledTimes(2)
    })

    describe('GET /api/v2/user/system/diskusage', () => {
        let server: Server
        let url: string
        let authorized: boolean

        beforeEach(async () => {
            authorized = true
            jest.spyOn(CaptainManager, 'get').mockReturnValue(manager)
            const authenticator = new Authenticator(
                'disk-usage-test',
                CaptainConstants.rootNameSpace
            )
            jest.spyOn(authenticator, 'decodeAuthToken').mockRejectedValue(
                new Error('Missing auth token')
            )
            jest.spyOn(Authenticator, 'getAuthenticator').mockReturnValue(
                authenticator
            )

            const app = express()
            app.use((_req, res, next) => {
                if (authorized) {
                    res.locals.user = {
                        namespace: CaptainConstants.rootNameSpace,
                        initialized: true,
                    }
                }
                next()
            })
            app.use('/api/v2/user', UserRouter)
            server = await new Promise<Server>((resolve) => {
                const listening = app.listen(0, '127.0.0.1', () =>
                    resolve(listening)
                )
            })
            const address = server.address() as AddressInfo
            url = `http://127.0.0.1:${address.port}/api/v2/user/system/diskusage`
        })

        afterEach(async () => {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()))
            })
        })

        test('returns the agreed response envelope and ignores caller-supplied paths', async () => {
            const response = await fetch(`${url}?path=/other-disk`)
            expect(response.status).toBe(200)
            expect(await response.json()).toEqual({
                status: ApiStatusCodes.STATUS_OK,
                description: 'Disk usage retrieved',
                data: normalUsage,
            })
            expect(readStats).toHaveBeenCalledWith(
                CaptainConstants.captainBaseDirectory
            )
        })

        test.each(['filesystem', 'node discovery'])(
            'returns a generic API error when %s collection fails',
            async (source) => {
                const error = new Error('internal collection details')
                if (source === 'filesystem') {
                    readStats.mockRejectedValue(error)
                } else {
                    getNodesInfo.mockRejectedValue(error)
                }

                const response = await fetch(url)
                expect(response.status).toBe(200)
                expect(await response.json()).toEqual({
                    status: ApiStatusCodes.STATUS_ERROR_GENERIC,
                    description: 'Unable to retrieve disk usage',
                    data: {},
                })
                expect(Logger.e).toHaveBeenCalledWith(
                    error,
                    'Unable to retrieve disk usage'
                )
            }
        )

        test('requires authentication before collecting disk usage', async () => {
            authorized = false
            const response = await fetch(url)
            expect(await response.json()).toMatchObject({
                status: ApiStatusCodes.STATUS_ERROR_NOT_AUTHORIZED,
            })
            expect(readStats).not.toHaveBeenCalled()
            expect(getNodesInfo).not.toHaveBeenCalled()
        })
    })
})
