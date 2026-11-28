import { readFileSync } from 'fs'
import { join } from 'path'
import * as yaml from 'yaml'
import AppsDataStore from '../src/datastore/AppsDataStore'
import { IAppVolume } from '../src/models/AppDefinition'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'
import OneClickAppDeployManager from '../src/user/oneclick/OneClickAppDeployManager'
import composeAppConfig from '../src/utils/ComposeAppConfig'
import DockerComposeToServiceOverride, {
    DOCKER_COMPOSE_TEMPLATE_NAME,
} from '../src/utils/DockerComposeToServiceOverride'

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

    test('preserves legacy v4 command override behavior for representative catalog templates', async () => {
        const v4Template = yaml.parse(`
captainVersion: 4
services:
  $$cap_appname:
    image: redis:7.2.4
    command: ['sh', '-c', 'redis-server --requirepass $REDIS_PASSWORD']
  $$cap_appname-cache:
    image: redis:7.2-alpine
    command: sh -c "redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb"
    entrypoint: ['/bin/ignored']
caproverOneClickApp:
  displayName: Legacy Redis Stack
  instructions:
    start: ''
    end: 'done'
  variables:
    - id: $$cap_appname
      label: App Name
`) as IOneClickTemplate

        const helper = OneClickAppDeploymentHelper.prototype
        jest.spyOn(helper, 'createRegisterPromise').mockResolvedValue(undefined)
        jest.spyOn(helper, 'createRegisterPromiseProject').mockResolvedValue(
            undefined
        )
        jest.spyOn(helper, 'createDeploymentPromise').mockResolvedValue({
            message: 'done',
        })
        const overrides = new Map<string, any>()
        jest.spyOn(helper, 'createConfigurationPromise').mockImplementation(
            async (appName, service, _capAppName, semantics) => {
                const raw =
                    DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                        service,
                        semantics!,
                        `services.${appName}`
                    )
                overrides.set(appName, raw ? yaml.parse(raw) : undefined)
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
            v4Template,
            [{ key: '$$cap_appname', value: 'my-redis' }],
            'OFFICIAL_REDIS'
        )
        await new Promise((resolve) => setImmediate(resolve))

        expect(states.mock.calls.at(-1)?.[0]).toMatchObject({
            error: '',
            successMessage: 'done',
        })
        expect(overrides.get('my-redis')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: [
                        'sh',
                        '-c',
                        'redis-server --requirepass $REDIS_PASSWORD',
                    ],
                },
            },
        })
        expect(overrides.get('my-redis-cache')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: [
                        'sh',
                        '-c',
                        'redis-server --maxmemory-policy allkeys-lru --maxmemory 200mb',
                    ],
                },
            },
        })
    })

    test('applies standard command and entrypoint semantics for v5 templates and direct Compose imports', async () => {
        const v5Template = yaml.parse(`
captainVersion: 5
services:
  $$cap_appname:
    image: redis:7.2.4
    entrypoint: ['/bin/sh', '-ec']
    command: ['redis-server --requirepass "$REDIS_PASSWORD"']
  $$cap_appname-worker:
    image: redis:7.2-alpine
    command: --appendonly yes --save "60 1"
caproverOneClickApp:
  displayName: V5 Redis Stack
  instructions:
    start: ''
    end: 'done'
  variables:
    - id: $$cap_appname
      label: App Name
`) as IOneClickTemplate

        // Existing frontend sets captainVersion: 4 on direct Docker Compose imports
        // and identifies them with templateName: 'DOCKER_COMPOSE'.
        const directComposeTemplate = yaml.parse(`
captainVersion: 4
services:
  web:
    image: node:24-alpine
    entrypoint: []
    command: node server.js --label "hello world"
  worker:
    image: alpine:3.20
    entrypoint: /bin/sh -ec
    command:
      - 'echo "$GREETING" && exec sleep 10'
caproverOneClickApp:
  displayName: Docker Compose
  instructions:
    start: ''
    end: 'done'
  variables: []
`) as IOneClickTemplate

        const helper = OneClickAppDeploymentHelper.prototype
        jest.spyOn(helper, 'createRegisterPromise').mockResolvedValue(undefined)
        jest.spyOn(helper, 'createRegisterPromiseProject').mockResolvedValue(
            undefined
        )
        jest.spyOn(helper, 'createDeploymentPromise').mockResolvedValue({
            message: 'done',
        })

        const run = async (
            template: IOneClickTemplate,
            values: { key: string; value: string }[],
            templateName: string
        ) => {
            const overrides = new Map<string, any>()
            jest.spyOn(helper, 'createConfigurationPromise').mockImplementation(
                async (appName, service, _capAppName, semantics) => {
                    const raw =
                        DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                            service,
                            semantics!,
                            `services.${appName}`
                        )
                    overrides.set(appName, raw ? yaml.parse(raw) : undefined)
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
            ).startDeployProcess(template, values, templateName)
            await new Promise((resolve) => setImmediate(resolve))
            expect(states.mock.calls.at(-1)?.[0]).toMatchObject({
                error: '',
                successMessage: 'done',
            })
            return overrides
        }

        const v5Overrides = await run(
            v5Template,
            [{ key: '$$cap_appname', value: 'v5-redis' }],
            'OFFICIAL_REDIS'
        )
        expect(v5Overrides.get('v5-redis')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: ['/bin/sh', '-ec'],
                    Args: ['redis-server --requirepass "$REDIS_PASSWORD"'],
                },
            },
        })
        expect(v5Overrides.get('v5-redis-worker')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Args: ['--appendonly', 'yes', '--save', '60 1'],
                },
            },
        })

        const composeOverrides = await run(
            directComposeTemplate,
            [],
            DOCKER_COMPOSE_TEMPLATE_NAME
        )
        expect(composeOverrides.get('web')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: [''],
                    Args: ['node', 'server.js', '--label', 'hello world'],
                },
            },
        })
        expect(composeOverrides.get('worker')).toEqual({
            TaskTemplate: {
                ContainerSpec: {
                    Command: ['/bin/sh', '-ec'],
                    Args: ['echo "$GREETING" && exec sleep 10'],
                },
            },
        })
    })
})
