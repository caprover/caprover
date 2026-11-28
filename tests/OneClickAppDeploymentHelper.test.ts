import * as yaml from 'yaml'
import * as appDefinitions from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'
import { IDockerComposeService } from '../src/models/IOneClickAppModels'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'
import { ComposeExecutionSemantics } from '../src/utils/DockerComposeToServiceOverride'

describe('one-click Compose configuration', () => {
    afterEach(() => jest.restoreAllMocks())

    async function configureApp(
        service: IDockerComposeService,
        semantics: ComposeExecutionSemantics
    ) {
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
            service,
            'my-stack',
            semantics
        )
        return update.mock.calls[0][0]
    }

    test('saves long-form entries through the existing app definition contract', async () => {
        const saved = await configureApp(
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
            'legacy'
        )
        expect(saved).toMatchObject({
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
        })
    })

    test.each([
        [
            'legacy',
            {
                image: 'redis:7',
                entrypoint: ['/bin/sh', '-c'],
                command: 'sh -c "redis-server --appendonly yes"',
            },
            { Command: ['sh', '-c', 'redis-server --appendonly yes'] },
        ],
        [
            'standard',
            {
                image: 'node:24-alpine',
                hostname: 'api-node',
                entrypoint: ['/bin/sh', '-ec'],
                command: ['echo hello && exec node app.js'],
            },
            {
                Hostname: 'api-node',
                Command: ['/bin/sh', '-ec'],
                Args: ['echo hello && exec node app.js'],
            },
        ],
    ] as [ComposeExecutionSemantics, IDockerComposeService, unknown][])(
        'persists %s serviceUpdateOverride through updateAppDefinition',
        async (semantics, service, expectedContainerSpec) => {
            const saved = await configureApp(service, semantics)
            expect(
                yaml.parse(saved.serviceUpdateOverride!).TaskTemplate
                    .ContainerSpec
            ).toEqual(expectedContainerSpec)
        }
    )

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
            { instanceCount: 2, description: 'scaled' },
            dataStore as any,
            serviceManager as any
        )

        expect(serviceManager.updateAppDefinition).toHaveBeenCalledTimes(1)
        expect(serviceManager.updateAppDefinition.mock.calls[0][18]).toBe(
            legacyOverride
        )
    })
})
