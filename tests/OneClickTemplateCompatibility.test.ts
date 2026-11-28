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

    test.each([
        [
            'v4 legacy catalog template (array + string command, ignored entrypoint)',
            `
captainVersion: 4
services:
  $$cap_appname:
    image: redis:7.2.4
    command: ['sh', '-c', 'redis-server --requirepass $REDIS_PASSWORD']
  $$cap_appname-cache:
    image: redis:7.2-alpine
    command: sh -c "redis-server --maxmemory 200mb"
    entrypoint: ['/bin/ignored']
caproverOneClickApp:
  displayName: Legacy Redis
  instructions: { start: '', end: 'done' }
  variables: [{ id: $$cap_appname, label: App Name }]
`,
            [{ key: '$$cap_appname', value: 'my-redis' }],
            'OFFICIAL_REDIS',
            {
                'my-redis': {
                    Command: [
                        'sh',
                        '-c',
                        'redis-server --requirepass $REDIS_PASSWORD',
                    ],
                },
                'my-redis-cache': {
                    Command: ['sh', '-c', 'redis-server --maxmemory 200mb'],
                },
            },
        ],
        [
            'v5 standard catalog template',
            `
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
  displayName: V5 Redis
  instructions: { start: '', end: 'done' }
  variables: [{ id: $$cap_appname, label: App Name }]
`,
            [{ key: '$$cap_appname', value: 'v5-redis' }],
            'OFFICIAL_REDIS',
            {
                'v5-redis': {
                    Command: ['/bin/sh', '-ec'],
                    Args: ['redis-server --requirepass "$REDIS_PASSWORD"'],
                },
                'v5-redis-worker': {
                    Args: ['--appendonly', 'yes', '--save', '60 1'],
                },
            },
        ],
        [
            'direct Compose import with legacy frontend captainVersion: 4',
            `
captainVersion: 4
services:
  web:
    image: node:24-alpine
    entrypoint: []
    command: node server.js --label "hello world"
caproverOneClickApp:
  displayName: Docker Compose
  instructions: { start: '', end: 'done' }
  variables: []
`,
            [],
            DOCKER_COMPOSE_TEMPLATE_NAME,
            {
                web: {
                    Command: [''],
                    Args: ['node', 'server.js', '--label', 'hello world'],
                },
            },
        ],
    ] as [
        string,
        string,
        { key: string; value: string }[],
        string,
        Record<string, unknown>,
    ][])(
        'applies expected command/entrypoint semantics for %s',
        async (_label, templateYaml, values, templateName, expectedSpecs) => {
            const template = yaml.parse(templateYaml) as IOneClickTemplate
            const helper = OneClickAppDeploymentHelper.prototype
            jest.spyOn(helper, 'createRegisterPromise').mockResolvedValue(
                undefined
            )
            jest.spyOn(
                helper,
                'createRegisterPromiseProject'
            ).mockResolvedValue(undefined)
            jest.spyOn(helper, 'createDeploymentPromise').mockResolvedValue({
                message: 'done',
            })
            const specs: Record<string, unknown> = {}
            jest.spyOn(helper, 'createConfigurationPromise').mockImplementation(
                async (appName, service, _capAppName, semantics) => {
                    const raw =
                        DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                            service,
                            semantics,
                            `services.${appName}`
                        )
                    specs[appName] = raw
                        ? yaml.parse(raw).TaskTemplate.ContainerSpec
                        : undefined
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
            expect(specs).toEqual(expectedSpecs)
        }
    )
})
