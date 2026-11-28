import * as yaml from 'yaml'
import * as appDefinitions from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'

describe('one-click Compose configuration', () => {
    afterEach(() => jest.restoreAllMocks())

    test('saves long-form entries through the existing app definition contract', async () => {
        jest.spyOn(appDefinitions, 'getAllAppDefinitions').mockResolvedValue({
            data: {
                appDefinitions: [
                    { appName: 'my-app', volumes: [], ports: [], envVars: [] },
                ],
            },
        } as any)
        const update = jest
            .spyOn(appDefinitions, 'updateAppDefinition')
            .mockResolvedValue({} as any)
        const helper = new OneClickAppDeploymentHelper({} as any, {} as any)
        await helper.createConfigurationPromise(
            'my-app',
            {
                image: 'nginx',
                environment: ['TOKEN=a=b', 'EMPTY='],
                volumes: [{ type: 'volume', source: 'data', target: '/data' }],
                ports: [
                    {
                        published: '8080',
                        target: 80,
                        protocol: 'tcp',
                        mode: 'host',
                    },
                ],
            },
            'my-stack'
        )
        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                appName: 'my-app',
                tags: [{ tagName: 'my-stack' }],
                envVars: [
                    { key: 'TOKEN', value: 'a=b' },
                    { key: 'EMPTY', value: '' },
                ],
                volumes: [{ volumeName: 'data', containerPath: '/data' }],
                ports: [
                    {
                        hostPort: 8080,
                        containerPort: 80,
                        protocol: 'tcp',
                        publishMode: 'host',
                    },
                ],
            }),
            expect.anything()
        )
    })

    test('persists legacy command override to ContainerSpec.Command and ignores entrypoint', async () => {
        jest.spyOn(appDefinitions, 'getAllAppDefinitions').mockResolvedValue({
            data: {
                appDefinitions: [
                    { appName: 'my-app', volumes: [], ports: [], envVars: [] },
                ],
            },
        } as any)
        const update = jest
            .spyOn(appDefinitions, 'updateAppDefinition')
            .mockResolvedValue({} as any)
        const helper = new OneClickAppDeploymentHelper({} as any, {} as any)

        await helper.createConfigurationPromise(
            'my-app',
            {
                image: 'redis:7',
                entrypoint: ['/bin/sh', '-c'],
                command: 'sh -c "redis-server --appendonly yes"',
            },
            'my-stack',
            'legacy'
        )

        const savedAppDef = update.mock.calls[0][0]
        expect(yaml.parse(savedAppDef.serviceUpdateOverride!)).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: ['sh', '-c', 'redis-server --appendonly yes'],
                },
            },
        })
    })

    test('persists standard entrypoint and command overrides to Command and Args', async () => {
        jest.spyOn(appDefinitions, 'getAllAppDefinitions').mockResolvedValue({
            data: {
                appDefinitions: [
                    { appName: 'my-app', volumes: [], ports: [], envVars: [] },
                ],
            },
        } as any)
        const update = jest
            .spyOn(appDefinitions, 'updateAppDefinition')
            .mockResolvedValue({} as any)
        const helper = new OneClickAppDeploymentHelper({} as any, {} as any)

        await helper.createConfigurationPromise(
            'my-app',
            {
                image: 'node:24-alpine',
                hostname: 'api-node',
                cap_add: ['NET_BIND_SERVICE'],
                entrypoint: ['/bin/sh', '-ec'],
                command: ['echo hello && exec node app.js'],
            },
            'my-stack',
            'standard'
        )

        const savedAppDef = update.mock.calls[0][0]
        expect(yaml.parse(savedAppDef.serviceUpdateOverride!)).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Hostname: 'api-node',
                    CapabilityAdd: ['CAP_NET_BIND_SERVICE'],
                    Command: ['/bin/sh', '-ec'],
                    Args: ['echo hello && exec node app.js'],
                },
            },
        })
    })

    test('preserves previously saved serviceUpdateOverride when patching an existing app', async () => {
        const legacyOverride = yaml.stringify({
            TaskTemplate: {
                ContainerSpec: {
                    Command: ['sh', '-c', 'redis-server --requirepass secret'],
                },
            },
        })
        const serviceManager = {
            updateAppDefinition: jest.fn().mockResolvedValue(undefined),
        }
        const dataStore = {
            getAppsDataStore: () => ({
                getAppDefinition: jest.fn().mockResolvedValue({
                    appName: 'legacy-redis',
                    description: 'old',
                    instanceCount: 1,
                    envVars: [],
                    volumes: [],
                    ports: [],
                    serviceUpdateOverride: legacyOverride,
                }),
            }),
        }

        await appDefinitions.patchAppDefinition(
            'legacy-redis',
            {
                instanceCount: 2,
                description: 'scaled',
            },
            dataStore as any,
            serviceManager as any
        )

        expect(serviceManager.updateAppDefinition).toHaveBeenCalledTimes(1)
        const updateArgs = serviceManager.updateAppDefinition.mock.calls[0]
        expect(updateArgs[18]).toBe(legacyOverride)
    })
})
