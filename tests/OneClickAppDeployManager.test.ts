import AppsDataStore from '../src/datastore/AppsDataStore'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'
import OneClickAppDeployManager, {
    ONE_CLICK_APP_NAME_VAR_NAME,
} from '../src/user/oneclick/OneClickAppDeployManager'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'

describe('OneClickAppDeployManager', () => {
    test('treats omitted values as an empty array', () => {
        const onDeploymentStateChanged = jest.fn()
        const manager = new OneClickAppDeployManager(
            {} as any,
            {} as any,
            onDeploymentStateChanged
        )

        const template: IOneClickTemplate = {
            captainVersion: 4,
            services: {},
            caproverOneClickApp: {
                displayName: 'Test App',
                instructions: {
                    start: '',
                    end: '',
                },
                variables: [
                    {
                        id: ONE_CLICK_APP_NAME_VAR_NAME,
                        label: 'App Name',
                    },
                ],
            },
        }

        expect(() => manager.startDeployProcess(template)).not.toThrow()
        expect(onDeploymentStateChanged).toHaveBeenCalledWith({
            steps: ['Parsing the template'],
            error: 'App name ($$cap_appname) is required.',
            currentStep: 0,
        })
    })

    describe('checks every app name before it creates anything', () => {
        const template: IOneClickTemplate = {
            captainVersion: 4,
            services: {
                [ONE_CLICK_APP_NAME_VAR_NAME]: { image: 'nginx' },
                [`${ONE_CLICK_APP_NAME_VAR_NAME}-worker`]: { image: 'nginx' },
            },
            caproverOneClickApp: {
                displayName: 'Test App',
                instructions: { start: '', end: 'done' },
                variables: [
                    { id: ONE_CLICK_APP_NAME_VAR_NAME, label: 'App Name' },
                ],
            },
        }

        // The steps that create something; each one only records its call.
        const helper = OneClickAppDeploymentHelper.prototype
        let creates: jest.SpyInstance[]
        beforeEach(() => {
            creates = [
                'createRegisterPromiseProject',
                'createRegisterPromise',
                'createConfigurationPromise',
                'createDeploymentPromise',
            ].map((step) =>
                jest.spyOn(helper, step as any).mockResolvedValue(undefined)
            )
        })
        afterEach(() => jest.restoreAllMocks())

        // Returns every state the deploy reported, after pending steps ran.
        async function deploy(appName: string, existingApps: string[] = []) {
            const onDeploymentStateChanged = jest.fn()
            const appsDataStore = new AppsDataStore(
                {
                    get: (key: string) =>
                        existingApps.includes(key.split('.')[1])
                            ? {}
                            : undefined,
                } as any,
                'captain'
            )
            new OneClickAppDeployManager(
                { getAppsDataStore: () => appsDataStore } as any,
                {} as any,
                onDeploymentStateChanged
            ).startDeployProcess(template, [
                { key: ONE_CLICK_APP_NAME_VAR_NAME, value: appName },
            ])
            await new Promise((resolve) => setImmediate(resolve))
            return onDeploymentStateChanged.mock.calls.map((call) => call[0])
        }

        test.each([
            [
                'a later app name that is too long',
                'a'.repeat(43),
                [],
                `${'a'.repeat(43)}-worker: App Name is not allowed. Only lowercase letters, numbers and single hyphens are allowed, up to 49 characters`,
            ],
            [
                'a later app name that already exists',
                'my-app',
                ['my-app-worker'],
                'my-app-worker: App Name already exists. Please use a different name',
            ],
            [
                'the first app name that already exists',
                'my-app',
                ['my-app'],
                'my-app: App Name already exists. Please use a different name',
            ],
        ])('%s', async (_case, appName, existingApps, error) => {
            expect(await deploy(appName, existingApps)).toEqual([
                { steps: ['Parsing the template'], error, currentStep: 0 },
            ])
            creates.forEach((create) => expect(create).not.toHaveBeenCalled())
        })

        test('names that pass are deployed as before', async () => {
            const states = await deploy('my-app')
            expect(states[states.length - 1]).toMatchObject({
                error: '',
                currentStep: 8,
                successMessage: 'done',
            })
            expect(creates[1].mock.calls.map((call) => call[0])).toEqual([
                'my-app',
                'my-app-worker',
            ])
        })

        test('uses the first service name when a multi-service template has no app name variable', async () => {
            const composeTemplate: IOneClickTemplate = {
                captainVersion: 4,
                services: {
                    database: { image: 'mariadb' },
                    web: { image: 'nginx', depends_on: ['database'] },
                },
                caproverOneClickApp: {
                    displayName: 'Docker Compose',
                    instructions: { start: '', end: 'done' },
                    variables: [],
                },
            }
            const states = jest.fn()
            const appsDataStore = new AppsDataStore({ get: jest.fn() } as any, 'captain')
            new OneClickAppDeployManager(
                { getAppsDataStore: () => appsDataStore } as any,
                {} as any,
                states
            ).startDeployProcess(composeTemplate, [])
            await new Promise((resolve) => setImmediate(resolve))

            expect(creates[0].mock.calls[0][0]).toBe('database')
            expect(creates[2].mock.calls.map((call) => call[2])).toEqual([
                'database',
                'database',
            ])
        })

        test('unsupported options in a later service fail before any project or app is created', () => {
            const onDeploymentStateChanged = jest.fn()
            const invalidTemplate = JSON.parse(JSON.stringify(template))
            invalidTemplate.services[
                `${ONE_CLICK_APP_NAME_VAR_NAME}-worker`
            ].ports = [{ published: 8080, target: 80, host_ip: '127.0.0.1' }]
            new OneClickAppDeployManager(
                {} as any,
                {} as any,
                onDeploymentStateChanged
            ).startDeployProcess(invalidTemplate, [
                { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
            ])
            expect(onDeploymentStateChanged).toHaveBeenCalledWith({
                steps: ['Parsing the template'],
                error: 'services.my-app-worker.ports[0].host_ip: option host_ip is not supported by CapRover',
                currentStep: 0,
            })
            creates.forEach((create) => expect(create).not.toHaveBeenCalled())
        })

        test.each([undefined, null, [], 'invalid', 1, true])(
            'rejects a malformed services collection: %j',
            (services) => {
                const onDeploymentStateChanged = jest.fn()
                const invalidTemplate = {
                    ...template,
                    services,
                } as unknown as IOneClickTemplate
                expect(() =>
                    new OneClickAppDeployManager(
                        {} as any,
                        {} as any,
                        onDeploymentStateChanged
                    ).startDeployProcess(invalidTemplate, [
                        { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
                    ])
                ).not.toThrow()
                expect(onDeploymentStateChanged).toHaveBeenCalledWith({
                    steps: ['Parsing the template'],
                    error: 'services: expected a mapping',
                    currentStep: 0,
                })
                creates.forEach((create) =>
                    expect(create).not.toHaveBeenCalled()
                )
            }
        )

        test.each([
            'data--backup',
            'data..backup',
            'data-',
            'data_',
            'data.',
            'a'.repeat(256),
        ])(
            'rejects a later invalid named volume before creating resources: %s',
            (volumeName) => {
                for (const volume of [
                    `${volumeName}:/data`,
                    { type: 'volume', source: volumeName, target: '/data' },
                ]) {
                    const onDeploymentStateChanged = jest.fn()
                    const invalidTemplate = JSON.parse(JSON.stringify(template))
                    invalidTemplate.services[
                        `${ONE_CLICK_APP_NAME_VAR_NAME}-worker`
                    ].volumes = [volume]
                    new OneClickAppDeployManager(
                        {} as any,
                        {} as any,
                        onDeploymentStateChanged
                    ).startDeployProcess(invalidTemplate, [
                        { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
                    ])
                    expect(onDeploymentStateChanged).toHaveBeenCalledWith({
                        steps: ['Parsing the template'],
                        error: 'services.my-app-worker.volumes[0].source: use a named volume or an absolute bind source path',
                        currentStep: 0,
                    })
                    creates.forEach((create) =>
                        expect(create).not.toHaveBeenCalled()
                    )
                }
            }
        )

        test.each([null, [], 'invalid', 1, true])(
            'rejects a malformed later service before dependency sorting: %j',
            (service) => {
                const onDeploymentStateChanged = jest.fn()
                const invalidTemplate = JSON.parse(JSON.stringify(template))
                invalidTemplate.services[
                    `${ONE_CLICK_APP_NAME_VAR_NAME}-worker`
                ] = service
                expect(() =>
                    new OneClickAppDeployManager(
                        {} as any,
                        {} as any,
                        onDeploymentStateChanged
                    ).startDeployProcess(invalidTemplate, [
                        { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
                    ])
                ).not.toThrow()
                expect(onDeploymentStateChanged).toHaveBeenCalledWith({
                    steps: ['Parsing the template'],
                    error: 'services.my-app-worker: expected a service mapping',
                    currentStep: 0,
                })
                creates.forEach((create) =>
                    expect(create).not.toHaveBeenCalled()
                )
            }
        )

        test('substitutes placeholders before validating long syntax and preserves the original template', async () => {
            const withVariables: IOneClickTemplate = JSON.parse(
                JSON.stringify(template)
            )
            withVariables.services[ONE_CLICK_APP_NAME_VAR_NAME] = {
                image: 'nginx',
                environment: ['TOKEN=$$cap_token'],
                volumes: [
                    {
                        type: 'volume',
                        source: '$$cap_appname-data',
                        target: '/data',
                    },
                ],
                ports: [
                    {
                        published: '$$cap_host_port',
                        target: '$$cap_container_port',
                        protocol: 'udp',
                        mode: 'host',
                    },
                ],
                command: ['run', '--verbose'],
            }
            withVariables.caproverOneClickApp.variables.push(
                ...['token', 'host_port', 'container_port'].map((key) => ({
                    id: `$$cap_${key}`,
                    label: key,
                }))
            )
            const snapshot = JSON.stringify(withVariables)
            const states = jest.fn()
            new OneClickAppDeployManager(
                {
                    getAppsDataStore: () => ({ nameAllowedOrThrow: jest.fn() }),
                } as any,
                {} as any,
                states
            ).startDeployProcess(withVariables, [
                { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
                { key: '$$cap_token', value: 'a=b' },
                { key: '$$cap_host_port', value: '8080' },
                { key: '$$cap_container_port', value: '80' },
            ])
            await new Promise((resolve) => setImmediate(resolve))
            expect(creates[2]).toHaveBeenCalledWith(
                'my-app',
                {
                    image: 'nginx',
                    environment: ['TOKEN=a=b'],
                    volumes: [
                        {
                            type: 'volume',
                            source: 'my-app-data',
                            target: '/data',
                        },
                    ],
                    ports: [
                        {
                            published: '8080',
                            target: '80',
                            protocol: 'udp',
                            mode: 'host',
                        },
                    ],
                    command: ['run', '--verbose'],
                },
                'my-app'
            )
            expect(states.mock.calls.at(-1)?.[0]).toMatchObject({
                error: '',
                successMessage: 'done',
            })
            expect(JSON.stringify(withVariables)).toBe(snapshot)
        })

        test('an error that is not about a name is thrown, not reported as one', () => {
            const manager = new OneClickAppDeployManager(
                {} as any,
                {} as any,
                jest.fn()
            )
            expect(() =>
                manager.startDeployProcess(template, [
                    { key: ONE_CLICK_APP_NAME_VAR_NAME, value: 'my-app' },
                ])
            ).toThrow(TypeError)
            creates.forEach((create) => expect(create).not.toHaveBeenCalled())
        })
    })
})
