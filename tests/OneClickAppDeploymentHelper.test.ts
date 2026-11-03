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
})
