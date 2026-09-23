import express = require('express')
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'
import oneClickRouter from '../src/routes/user/oneclick/OneClickAppRouter'
import OneClickAppDeployManager from '../src/user/oneclick/OneClickAppDeployManager'
import { OneClickDeploymentJobRegistry } from '../src/user/oneclick/OneClickDeploymentJobRegistry'
import Logger from '../src/utils/Logger'

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
            const listeningServer = app.listen(0, () => resolve(listeningServer))
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
        expect(startDeployProcess).toHaveBeenCalledWith(template, [])
        expect(registry.createJob).toHaveBeenCalledTimes(1)
        expect(registry.removeJob).not.toHaveBeenCalled()
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
