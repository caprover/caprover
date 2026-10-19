import { readFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'yaml'
import AppsDataStore from '../src/datastore/AppsDataStore'
import { IAppVolume } from '../src/models/AppDefinition'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'
import OneClickAppDeployManager from '../src/user/oneclick/OneClickAppDeployManager'
import composeAppConfig from '../src/utils/ComposeAppConfig'

describe('official One-Click template compatibility', () => {
    afterEach(() => jest.restoreAllMocks())

    test.each([
        [
            'Home-Assistant',
            [
                { hostPath: '/etc/localtime', containerPath: '/etc/localtime' },
                { hostPath: '/run/dbus', containerPath: '/run/dbus' },
            ],
        ],
        [
            'immich',
            [{ hostPath: '/etc/localtime', containerPath: '/etc/localtime' }],
        ],
        [
            'kimai2',
            [
                {
                    volumeName: 'fixture-app-public',
                    containerPath: '/opt/kimai/public',
                },
            ],
        ],
    ] as [string, IAppVolume[]][])(
        'deploys %s with its legacy mount behavior',
        async (name, legacyMounts) => {
            const template = yaml.parse(
                readFileSync(
                    join(__dirname, 'fixtures', 'oneclick', `${name}.yml`),
                    'utf8'
                )
            ) as IOneClickTemplate
            template.caproverOneClickApp.variables.push(
                {
                    id: '$$cap_appname',
                    label: 'App Name',
                    defaultValue: 'fixture-app',
                },
                {
                    id: '$$cap_root_domain',
                    label: 'Root Domain',
                    defaultValue: 'example.test',
                }
            )
            const helper = OneClickAppDeploymentHelper.prototype
            const register = jest
                .spyOn(helper, 'createRegisterPromise')
                .mockResolvedValue(undefined)
            jest.spyOn(
                helper,
                'createRegisterPromiseProject'
            ).mockResolvedValue(undefined)
            jest.spyOn(helper, 'createDeploymentPromise').mockResolvedValue({
                message: 'done',
            })
            const configs = new Map<
                string,
                ReturnType<typeof composeAppConfig>
            >()
            jest.spyOn(helper, 'createConfigurationPromise').mockImplementation(
                async (appName, service) => {
                    configs.set(
                        appName,
                        composeAppConfig(service, `services.${appName}`)
                    )
                    return { message: 'configured' }
                }
            )
            const states = jest.fn()
            const appsDataStore = new AppsDataStore(
                { get: () => undefined } as any,
                'captain'
            )
            new OneClickAppDeployManager(
                { getAppsDataStore: () => appsDataStore } as any,
                {} as any,
                states
            ).startDeployProcess(
                template,
                template.caproverOneClickApp.variables.map((variable) => {
                    const value = String(variable.defaultValue ?? '')
                    return {
                        key: variable.id,
                        value: value.startsWith('$$cap_gen_random_hex')
                            ? 'fixture-password'
                            : value,
                    }
                })
            )
            await new Promise((resolve) => setImmediate(resolve))
            expect(states.mock.calls.at(-1)?.[0]).toMatchObject({
                error: '',
                successMessage: expect.any(String),
            })
            expect(register).toHaveBeenCalledTimes(
                Object.keys(template.services).length
            )
            expect(configs.get('fixture-app')?.volumes).toEqual(
                expect.arrayContaining(legacyMounts)
            )
        }
    )
})
