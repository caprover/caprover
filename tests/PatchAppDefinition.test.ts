/**
 * TEST FILE: PatchAppDefinition.test.ts
 *
 * Tests the `patchAppDefinition` handler which partially updates an app
 * definition by merging only the provided fields with existing values.
 *
 * This ensures that operations like scaling (changing instanceCount) do not
 * accidentally wipe env vars, volumes, ports, or other app configuration.
 */

import { patchAppDefinition } from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'
import { IAppDef } from '../src/models/AppDefinition'

const mockExistingApp: IAppDef = {
    description: 'My test app',
    deployedVersion: 5,
    notExposeAsWebApp: false,
    hasPersistentData: false,
    hasDefaultSubDomainSsl: true,
    containerHttpPort: 3000,
    captainDefinitionRelativeFilePath: './captain-definition',
    forceSsl: true,
    websocketSupport: true,
    nodeId: 'node-abc',
    instanceCount: 2,
    preDeployFunction: 'console.log("pre")',
    serviceUpdateOverride: '',
    customNginxConfig: '',
    redirectDomain: '',
    networks: ['captain-overlay-network'],
    customDomain: [],
    tags: [{ tagName: 'production' }],
    ports: [{ containerPort: 3000, hostPort: 3000, protocol: 'tcp' }],
    volumes: [
        {
            containerPath: '/data',
            volumeName: 'app-data',
        },
    ],
    envVars: [
        { key: 'API_HOST', value: 'https://api.example.com' },
        { key: 'API_KEY', value: 'secret-key-123' },
        { key: 'DB_URL', value: 'postgres://localhost/mydb' },
    ],
    versions: [],
    appDeployTokenConfig: { enabled: true, appDeployToken: 'tok-123' },
    appPushWebhook: {
        tokenVersion: 'v1',
        repoInfo: {
            repo: 'my-repo',
            branch: 'main',
            user: 'my-user',
            password: 'my-pass',
        },
        pushWebhookToken: 'webhook-tok',
    },
    httpAuth: { user: 'admin', password: 'pass123' },
}

// Track what updateAppDefinition receives via the serviceManager mock
let capturedUpdateArgs: any[] = []

const mockDataStore = {
    getAppsDataStore: () => ({
        getAppDefinition: jest.fn().mockResolvedValue(mockExistingApp),
    }),
} as any

const mockServiceManager = {
    updateAppDefinition: jest.fn().mockImplementation((...args: any[]) => {
        capturedUpdateArgs = args
        return Promise.resolve()
    }),
    ensureNotBuilding: jest.fn().mockResolvedValue(undefined),
    dataStore: mockDataStore,
} as any

describe('patchAppDefinition', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        capturedUpdateArgs = []
    })

    it('should preserve all existing fields when only instanceCount is provided', async () => {
        await patchAppDefinition(
            'my-app',
            { appName: 'my-app', instanceCount: 1 },
            mockDataStore,
            mockServiceManager
        )

        expect(mockServiceManager.updateAppDefinition).toHaveBeenCalledTimes(1)

        // serviceManager.updateAppDefinition positional args:
        // 0=appName, 1=projectId, 2=description, 3=instanceCount, 4=captainDefPath,
        // 5=envVars, 6=volumes, 7=tags, 8=nodeId, 9=notExposeAsWebApp,
        // 10=containerHttpPort, 11=httpAuth, 12=forceSsl, 13=ports,
        // 14=repoInfo, 15=customNginxConfig, 16=redirectDomain,
        // 17=preDeployFunction, 18=serviceUpdateOverride, 19=websocketSupport,
        // 20=appDeployTokenConfig
        const args = capturedUpdateArgs
        expect(args[0]).toBe('my-app') // appName
        expect(args[3]).toBe(1) // instanceCount — patched

        // envVars (arg 5) should be preserved
        expect(args[5]).toEqual(mockExistingApp.envVars)
        expect(args[5]).toHaveLength(3)

        // volumes (arg 6) preserved
        expect(args[6]).toEqual(mockExistingApp.volumes)

        // tags (arg 7) preserved
        expect(args[7]).toEqual(mockExistingApp.tags)

        // forceSsl (arg 12) preserved
        expect(args[12]).toBe(true)

        // websocketSupport (arg 19) preserved
        expect(args[19]).toBe(true)
    })

    it('should preserve env vars when scaling to zero', async () => {
        await patchAppDefinition(
            'my-app',
            { appName: 'my-app', instanceCount: 0 },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        expect(args[3]).toBe(0) // instanceCount
        expect(args[5]).toEqual(mockExistingApp.envVars) // envVars preserved
        expect(args[5]).toHaveLength(3)
    })

    it('should update only the provided fields', async () => {
        await patchAppDefinition(
            'my-app',
            {
                appName: 'my-app',
                instanceCount: 3,
                description: 'Updated description',
                forceSsl: false,
            },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        expect(args[3]).toBe(3) // instanceCount — patched
        expect(args[2]).toBe('Updated description') // description — patched
        expect(args[12]).toBe(false) // forceSsl — patched

        // Non-provided fields preserved
        expect(args[5]).toEqual(mockExistingApp.envVars)
        expect(args[6]).toEqual(mockExistingApp.volumes)
        expect(args[19]).toBe(true) // websocketSupport preserved
    })

    it('should allow updating env vars explicitly', async () => {
        const newEnvVars = [{ key: 'NEW_VAR', value: 'new-value' }]

        await patchAppDefinition(
            'my-app',
            { appName: 'my-app', envVars: newEnvVars },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        expect(args[5]).toEqual(newEnvVars) // envVars — patched
        expect(args[5]).toHaveLength(1)
        expect(args[3]).toBe(2) // instanceCount preserved from existing
    })

    it('should allow setting envVars to empty array explicitly', async () => {
        await patchAppDefinition(
            'my-app',
            { appName: 'my-app', envVars: [] },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        expect(args[5]).toEqual([]) // envVars — explicitly emptied
        expect(args[3]).toBe(2) // instanceCount preserved
        expect(args[6]).toEqual(mockExistingApp.volumes) // volumes preserved
    })

    it('should throw error when appName is missing', async () => {
        await expect(
            patchAppDefinition(
                '',
                { instanceCount: 1 },
                mockDataStore,
                mockServiceManager
            )
        ).rejects.toThrow()
    })

    it('should preserve httpAuth from existing app', async () => {
        await patchAppDefinition(
            'my-app',
            { appName: 'my-app', instanceCount: 1 },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        // httpAuth is arg 11
        expect(args[11]).toEqual(mockExistingApp.httpAuth)
    })

    it('should handle multiple fields updated at once', async () => {
        await patchAppDefinition(
            'my-app',
            {
                appName: 'my-app',
                instanceCount: 5,
                containerHttpPort: 8080,
                websocketSupport: false,
                notExposeAsWebApp: true,
                redirectDomain: 'example.com',
            },
            mockDataStore,
            mockServiceManager
        )

        const args = capturedUpdateArgs
        expect(args[3]).toBe(5) // instanceCount
        expect(args[10]).toBe(8080) // containerHttpPort
        expect(args[19]).toBe(false) // websocketSupport
        expect(args[9]).toBe(true) // notExposeAsWebApp
        expect(args[16]).toBe('example.com') // redirectDomain

        // Non-provided preserved
        expect(args[5]).toEqual(mockExistingApp.envVars)
        expect(args[12]).toBe(true) // forceSsl
        expect(args[2]).toBe('My test app') // description
    })
})
