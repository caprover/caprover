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
