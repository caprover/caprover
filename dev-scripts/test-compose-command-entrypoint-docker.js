// Requires `npm ci`, `npm run build`, and a local Docker daemon with Swarm active
// (or pass `--ephemeral-swarm` on a disposable host to init/leave Swarm automatically).
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtemp, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const Docker = require('dockerode')
const yaml = require('yaml')

const {
    default: DockerComposeToServiceOverride,
    DOCKER_COMPOSE_TEMPLATE_NAME,
} = require('../built/utils/DockerComposeToServiceOverride')
const Utils = require('../built/utils/Utils').default
const AppsDataStore = require('../built/datastore/AppsDataStore').default
const OneClickAppDeployManager =
    require('../built/user/oneclick/OneClickAppDeployManager').default
const OneClickAppDeploymentHelper =
    require('../built/user/oneclick/OneClickAppDeploymentHelper').default
const AppDefinitionHandler = require('../built/handlers/users/apps/appdefinition/AppDefinitionHandler')
const Logger = require('../built/utils/Logger').default

Logger.d = () => {}
Logger.dev = () => {}

const BASE_IMAGE = 'node:24-alpine'
const RUN_ID = `caprover-cmdtest-${Date.now().toString(36)}`
const ALLOW_EPHEMERAL_SWARM = process.argv.includes('--ephemeral-swarm')

const PROBE_SCRIPT = `#!/usr/bin/env node
console.log(JSON.stringify({
  argv: process.argv.slice(2),
  testVar: process.env.TEST_VAR || ''
}))
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
setTimeout(() => process.exit(0), 60000)
`

const docker = new Docker()
const createdServices = new Set()
const createdImages = []

function dockerCli(args, opts = {}) {
    return execFileSync('docker', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
        ...opts,
    }).trim()
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function buildTestImage(rootDir, name, dockerfileLines) {
    const tag = `${name}:${RUN_ID}`
    const dir = join(rootDir, name)
    const fs = require('node:fs/promises')
    await fs.mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'probe.js'), PROBE_SCRIPT, { mode: 0o755 })
    await writeFile(
        join(dir, 'Dockerfile'),
        [
            `FROM ${BASE_IMAGE}`,
            'COPY probe.js /usr/local/bin/probe',
            'RUN chmod +x /usr/local/bin/probe',
            ...dockerfileLines,
            '',
        ].join('\n')
    )
    dockerCli(['build', '-q', '-t', tag, dir])
    createdImages.push(tag)
    return tag
}

function parseProbeOutput(rawLogs) {
    const lines = rawLogs
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    const jsonLine = lines.find((line) => line.startsWith('{'))
    if (!jsonLine) {
        throw new Error(
            `Expected JSON probe output in logs, got: ${JSON.stringify(rawLogs)}`
        )
    }
    return {
        lines,
        probe: JSON.parse(jsonLine),
    }
}

function escapeComposeInterpolation(value) {
    if (typeof value === 'string') {
        return value.replace(/\$/g, () => '$$')
    }
    if (Array.isArray(value)) {
        return value.map(escapeComposeInterpolation)
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([k, v]) => [
                k,
                escapeComposeInterpolation(v),
            ])
        )
    }
    return value
}

async function runNativeCompose(rootDir, caseName, serviceDef) {
    const dir = join(rootDir, `compose-${caseName}`)
    const fs = require('node:fs/promises')
    await fs.mkdir(dir, { recursive: true })
    const projectName = `${RUN_ID}-${caseName}`.replace(/[^a-z0-9_-]/g, '')
    const composeFile = join(dir, 'compose.yml')
    await writeFile(
        composeFile,
        yaml.stringify({
            services: {
                app: {
                    // Escape `$` as `$$` for native `docker compose` YAML interpolation
                    // so both Compose and CapRover receive the same literal command/entrypoint values.
                    ...escapeComposeInterpolation(serviceDef),
                    environment: {
                        TEST_VAR: 'from-container-env',
                        ...(serviceDef.environment || {}),
                    },
                },
            },
        })
    )

    try {
        dockerCli(['compose', '-f', composeFile, '-p', projectName, 'up', '-d'])
        const containerId = dockerCli([
            'compose',
            '-f',
            composeFile,
            '-p',
            projectName,
            'ps',
            '-q',
            'app',
        ])
        assert.ok(containerId, `No compose container started for ${caseName}`)

        // Wait until the probe prints its JSON line
        let logs = ''
        for (let attempt = 0; attempt < 40; attempt++) {
            logs = dockerCli(['logs', containerId])
            if (logs.includes('"argv"')) break
            await sleep(250)
        }
        const inspected = JSON.parse(dockerCli(['inspect', containerId]))[0]
        return {
            path: inspected.Path,
            args: inspected.Args,
            entrypoint: inspected.Config.Entrypoint,
            cmd: inspected.Config.Cmd,
            ...parseProbeOutput(logs),
        }
    } finally {
        try {
            dockerCli([
                'compose',
                '-f',
                composeFile,
                '-p',
                projectName,
                'down',
                '-v',
                '--remove-orphans',
                '-t',
                '1',
            ])
        } catch {
            // best effort
        }
    }
}

async function waitForSwarmTask(serviceName, expectedEnvMarker) {
    const deadline = Date.now() + 45000
    let lastTask = null
    while (Date.now() < deadline) {
        const tasks = await docker.listTasks({
            filters: { service: [serviceName] },
        })
        const matching = tasks
            .filter(
                (t) =>
                    !expectedEnvMarker ||
                    (t.Spec?.ContainerSpec?.Env || []).includes(
                        expectedEnvMarker
                    )
            )
            .sort((a, b) => (b.Version?.Index || 0) - (a.Version?.Index || 0))

        for (const task of matching) {
            lastTask = task
            const state = task.Status?.State
            const containerId = task.Status?.ContainerStatus?.ContainerID
            if (containerId && (state === 'running' || state === 'complete')) {
                const logs = dockerCli(['logs', containerId])
                if (logs.includes('"argv"')) {
                    const inspected = JSON.parse(
                        dockerCli(['inspect', containerId])
                    )[0]
                    return {
                        task,
                        path: inspected.Path,
                        args: inspected.Args,
                        entrypoint: inspected.Config.Entrypoint,
                        cmd: inspected.Config.Cmd,
                        ...parseProbeOutput(logs),
                    }
                }
            }
            if (state === 'failed' || state === 'rejected') {
                return {
                    task,
                    failed: true,
                    error: task.Status?.Err || task.Status?.Message || state,
                }
            }
        }
        await sleep(300)
    }
    throw new Error(
        `Timed out waiting for Swarm task on ${serviceName}; last state=${lastTask?.Status?.State} err=${lastTask?.Status?.Err}`
    )
}

async function createSwarmServiceWithOverride(
    serviceName,
    image,
    overrideYaml,
    env = ['TEST_VAR=from-container-env']
) {
    const baseSpec = {
        Name: serviceName,
        TaskTemplate: {
            ContainerSpec: {
                Image: image,
                Env: env,
            },
            RestartPolicy: {
                Condition: 'none',
            },
        },
        Mode: {
            Replicated: {
                Replicas: 1,
            },
        },
    }
    const parsedOverride = Utils.convertYamlOrJsonToObject(overrideYaml)
    const finalSpec = Utils.mergeObjects(baseSpec, parsedOverride)

    await docker.createService(finalSpec)
    createdServices.add(serviceName)
    return waitForSwarmTask(serviceName, env[0])
}

async function updateSwarmServiceLikeCapRover(
    serviceName,
    overrideYaml,
    env = ['TEST_VAR=from-container-env', 'REDEPLOY_GEN=2']
) {
    const service = docker.getService(serviceName)
    const readData = await service.inspect()
    const data = JSON.parse(JSON.stringify(readData))
    const updatedData = data.Spec
    updatedData.version = parseInt(data.Version.Index, 10)
    updatedData.TaskTemplate.ContainerSpec.Env = env
    updatedData.TaskTemplate.ForceUpdate =
        (updatedData.TaskTemplate.ForceUpdate || 0) + 1
    const parsedOverride = Utils.convertYamlOrJsonToObject(overrideYaml)
    const merged = Utils.mergeObjects(updatedData, parsedOverride)
    await service.update(merged)
    return waitForSwarmTask(serviceName, 'REDEPLOY_GEN=2')
}

async function removeService(serviceName) {
    if (!createdServices.has(serviceName)) return
    try {
        await docker.getService(serviceName).remove()
    } catch {
        // best effort
    }
    createdServices.delete(serviceName)
}

async function deployThroughCapRoverPipeline(template, values, templateName) {
    const savedOverrides = new Map()
    const origGetAll = AppDefinitionHandler.getAllAppDefinitions
    const origUpdate = AppDefinitionHandler.updateAppDefinition
    const origRegister =
        OneClickAppDeploymentHelper.prototype.createRegisterPromise
    const origRegisterProject =
        OneClickAppDeploymentHelper.prototype.createRegisterPromiseProject
    const origDeploy =
        OneClickAppDeploymentHelper.prototype.createDeploymentPromise

    AppDefinitionHandler.getAllAppDefinitions = async () => ({
        data: {
            appDefinitions: Array.from(savedOverrides.keys()).map(
                (appName) => ({
                    appName,
                    volumes: [],
                    ports: [],
                    envVars: [],
                })
            ),
        },
    })
    AppDefinitionHandler.updateAppDefinition = async (params) => {
        savedOverrides.set(params.appName, params.serviceUpdateOverride)
        return { message: 'saved' }
    }
    OneClickAppDeploymentHelper.prototype.createRegisterPromise = async (
        appName
    ) => {
        savedOverrides.set(appName, undefined)
    }
    OneClickAppDeploymentHelper.prototype.createRegisterPromiseProject =
        async () => {}
    OneClickAppDeploymentHelper.prototype.createDeploymentPromise =
        async () => {}

    try {
        const appsDataStore = new AppsDataStore(
            { get: () => undefined },
            'captain'
        )
        const finalState = await new Promise((resolve, reject) => {
            new OneClickAppDeployManager(
                { getAppsDataStore: () => appsDataStore },
                {},
                (state) => {
                    if (state.error) {
                        reject(new Error(state.error))
                    } else if (state.successMessage !== undefined) {
                        resolve(state)
                    }
                }
            ).startDeployProcess(template, values, templateName)
        })
        assert.equal(finalState.error, '')
        return savedOverrides
    } finally {
        AppDefinitionHandler.getAllAppDefinitions = origGetAll
        AppDefinitionHandler.updateAppDefinition = origUpdate
        OneClickAppDeploymentHelper.prototype.createRegisterPromise =
            origRegister
        OneClickAppDeploymentHelper.prototype.createRegisterPromiseProject =
            origRegisterProject
        OneClickAppDeploymentHelper.prototype.createDeploymentPromise =
            origDeploy
    }
}

async function main() {
    const serverVersion = dockerCli([
        'version',
        '--format',
        '{{.Server.Version}}',
    ])
    const composeVersion = dockerCli(['compose', 'version', '--short'])
    const initialSwarmState = dockerCli([
        'info',
        '--format',
        '{{.Swarm.LocalNodeState}}',
    ])
    console.log(
        `Docker Engine ${serverVersion}, Docker Compose ${composeVersion}, Swarm=${initialSwarmState}`
    )

    let initializedEphemeralSwarm = false
    if (initialSwarmState !== 'active') {
        if (!ALLOW_EPHEMERAL_SWARM) {
            throw new Error(
                `Swarm is "${initialSwarmState}". Re-run on a Swarm node or pass --ephemeral-swarm on a disposable environment.`
            )
        }
        dockerCli(['swarm', 'init', '--advertise-addr', '127.0.0.1'])
        initializedEphemeralSwarm = true
        console.log('Initialized temporary local Swarm for integration test')
    }

    const rootDir = await mkdtemp(join(tmpdir(), 'caprover-compose-cmd-'))
    try {
        const imgBoth = await buildTestImage(rootDir, 'img-both', [
            'ENTRYPOINT ["/usr/local/bin/probe", "IMG_EP"]',
            'CMD ["IMG_CMD_1", "IMG_CMD_2"]',
        ])
        const imgCmdOnly = await buildTestImage(rootDir, 'img-cmd-only', [
            'ENTRYPOINT []',
            'CMD ["/usr/local/bin/probe", "IMG_CMD_ONLY"]',
        ])
        const imgEpOnly = await buildTestImage(rootDir, 'img-ep-only', [
            'ENTRYPOINT ["/usr/local/bin/probe", "IMG_EP_ONLY"]',
        ])

        const equivalenceCases = [
            {
                name: 'omitted-both-img-both',
                service: { image: imgBoth },
                expectedArgv: ['IMG_EP', 'IMG_CMD_1', 'IMG_CMD_2'],
            },
            {
                name: 'omitted-both-img-cmd-only',
                service: { image: imgCmdOnly },
                expectedArgv: ['IMG_CMD_ONLY'],
            },
            {
                name: 'omitted-both-img-ep-only',
                service: { image: imgEpOnly },
                expectedArgv: ['IMG_EP_ONLY'],
            },
            {
                name: 'null-both-img-both',
                service: { image: imgBoth, entrypoint: null, command: null },
                expectedArgv: ['IMG_EP', 'IMG_CMD_1', 'IMG_CMD_2'],
            },
            {
                name: 'standard-cmd-array-img-both',
                service: {
                    image: imgBoth,
                    command: ['arg one', '', '$TEST_VAR', 'a && b'],
                },
                expectedArgv: ['IMG_EP', 'arg one', '', '$TEST_VAR', 'a && b'],
            },
            {
                name: 'standard-cmd-string-quoting-img-both',
                service: {
                    image: imgBoth,
                    command:
                        'plain "two words" \'\' foo\\ bar --k="v 1" \'$TEST_VAR\'',
                },
                expectedArgv: [
                    'IMG_EP',
                    'plain',
                    'two words',
                    '',
                    'foo bar',
                    '--k=v 1',
                    '$TEST_VAR',
                ],
            },
            {
                name: 'standard-cmd-only-img-cmd-only',
                service: {
                    image: imgCmdOnly,
                    command: ['/usr/local/bin/probe', 'REPLACED_CMD'],
                },
                expectedArgv: ['REPLACED_CMD'],
            },
            {
                name: 'standard-ep-only-suppresses-img-cmd',
                service: {
                    image: imgBoth,
                    entrypoint: ['/usr/local/bin/probe', 'NEW_EP'],
                },
                expectedArgv: ['NEW_EP'],
            },
            {
                name: 'standard-ep-and-empty-cmd-array-suppresses-img-cmd',
                service: {
                    image: imgBoth,
                    entrypoint: ['/usr/local/bin/probe', 'NEW_EP'],
                    command: [],
                },
                expectedArgv: ['NEW_EP'],
            },
            {
                name: 'standard-ep-and-empty-cmd-string-suppresses-img-cmd',
                service: {
                    image: imgBoth,
                    entrypoint: '/usr/local/bin/probe NEW_EP',
                    command: '',
                },
                expectedArgv: ['NEW_EP'],
            },
            {
                name: 'standard-ep-and-cmd-explicit-shell',
                service: {
                    image: imgBoth,
                    entrypoint: ['/bin/sh', '-ec'],
                    command: [
                        'exec /usr/local/bin/probe "hello $TEST_VAR" "" "a && b"',
                    ],
                },
                expectedArgv: ['hello from-container-env', '', 'a && b'],
            },
            {
                name: 'standard-clear-ep-array-with-cmd-img-both',
                service: {
                    image: imgBoth,
                    entrypoint: [],
                    command: ['/usr/local/bin/probe', 'DIRECT_EXEC', 'arg2'],
                },
                expectedArgv: ['DIRECT_EXEC', 'arg2'],
            },
            {
                name: 'standard-clear-ep-string-with-cmd-img-ep-only',
                service: {
                    image: imgEpOnly,
                    entrypoint: '',
                    command: '/usr/local/bin/probe "CLEARED EP" \'\'',
                },
                expectedArgv: ['CLEARED EP', ''],
            },
        ]

        console.log(
            '\n=== 1. Native Docker Compose vs Swarm (Standard Semantics) ==='
        )
        for (const testCase of equivalenceCases) {
            const composeRes = await runNativeCompose(
                rootDir,
                testCase.name,
                testCase.service
            )
            const overrideYaml =
                DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                    testCase.service,
                    'standard',
                    `services.${testCase.name}`
                )
            const svcName = `${RUN_ID}-${testCase.name}`
                .slice(0, 60)
                .replace(/-+$/, '')
            let swarmRes
            try {
                swarmRes = await createSwarmServiceWithOverride(
                    svcName,
                    testCase.service.image,
                    overrideYaml
                )
            } finally {
                await removeService(svcName)
            }

            assert.ok(
                !swarmRes.failed,
                `Swarm task failed for ${testCase.name}: ${swarmRes.error}`
            )
            assert.deepEqual(composeRes.probe.argv, testCase.expectedArgv)
            assert.deepEqual(swarmRes.probe.argv, composeRes.probe.argv)
            assert.equal(swarmRes.path, composeRes.path)
            assert.deepEqual(swarmRes.args, composeRes.args)
            console.log(
                `PASS [compose == swarm]: ${testCase.name} -> path=${swarmRes.path} argv=${JSON.stringify(swarmRes.probe.argv)}`
            )
        }

        console.log(
            '\n=== 2. CapRover Full Pipeline (Legacy v4 vs Standard v5 vs Direct Compose) + Redeploy ==='
        )
        const legacyV4Template = {
            captainVersion: 4,
            services: {
                '$$cap_appname-arr': {
                    image: imgBoth,
                    entrypoint: ['/bin/should-be-ignored'],
                    command: ['/usr/local/bin/probe', 'LEGACY_ARR'],
                },
                '$$cap_appname-str': {
                    image: imgBoth,
                    command: '/usr/local/bin/probe "LEGACY STR"',
                },
            },
            caproverOneClickApp: {
                displayName: 'Legacy V4 Test',
                instructions: { start: '', end: 'done' },
                variables: [{ id: '$$cap_appname', label: 'App Name' }],
            },
        }
        const legacyOverrides = await deployThroughCapRoverPipeline(
            legacyV4Template,
            [{ key: '$$cap_appname', value: 'leg' }],
            'OFFICIAL_TEST'
        )

        const v5Template = {
            captainVersion: 5,
            services: {
                '$$cap_appname-std': {
                    image: imgBoth,
                    entrypoint: ['/bin/sh', '-ec'],
                    command: ['exec /usr/local/bin/probe "V5 $TEST_VAR"'],
                },
            },
            caproverOneClickApp: {
                displayName: 'Standard V5 Test',
                instructions: { start: '', end: 'done' },
                variables: [{ id: '$$cap_appname', label: 'App Name' }],
            },
        }
        const v5Overrides = await deployThroughCapRoverPipeline(
            v5Template,
            [{ key: '$$cap_appname', value: 'v5' }],
            'OFFICIAL_TEST'
        )

        const directComposeTemplate = {
            captainVersion: 4,
            services: {
                'compose-svc': {
                    image: imgBoth,
                    command: ['FROM_COMPOSE_ARGS'],
                },
            },
            caproverOneClickApp: {
                displayName: 'Docker Compose',
                instructions: { start: '', end: 'done' },
                variables: [],
            },
        }
        const composeOverrides = await deployThroughCapRoverPipeline(
            directComposeTemplate,
            [],
            DOCKER_COMPOSE_TEMPLATE_NAME
        )

        const pipelineChecks = [
            {
                name: 'legacy-v4-array',
                image: imgBoth,
                overrideYaml: legacyOverrides.get('leg-arr'),
                expectedArgv: ['LEGACY_ARR'],
                redeploy: true,
            },
            {
                name: 'legacy-v4-string',
                image: imgBoth,
                overrideYaml: legacyOverrides.get('leg-str'),
                expectedArgv: ['LEGACY STR'],
                redeploy: false,
            },
            {
                name: 'standard-v5-shell',
                image: imgBoth,
                overrideYaml: v5Overrides.get('v5-std'),
                expectedArgv: ['V5 from-container-env'],
                redeploy: true,
            },
            {
                name: 'direct-compose-v4-payload',
                image: imgBoth,
                overrideYaml: composeOverrides.get('compose-svc'),
                expectedArgv: ['IMG_EP', 'FROM_COMPOSE_ARGS'],
                redeploy: true,
            },
        ]

        for (const check of pipelineChecks) {
            const svcName = `${RUN_ID}-pipe-${check.name}`
                .slice(0, 60)
                .replace(/-+$/, '')
            try {
                const initial = await createSwarmServiceWithOverride(
                    svcName,
                    check.image,
                    check.overrideYaml
                )
                assert.ok(
                    !initial.failed,
                    `Pipeline deploy failed for ${check.name}: ${initial.error}`
                )
                assert.deepEqual(initial.probe.argv, check.expectedArgv)
                console.log(
                    `PASS [pipeline deploy]: ${check.name} -> argv=${JSON.stringify(initial.probe.argv)}`
                )

                if (check.redeploy) {
                    const redeployed = await updateSwarmServiceLikeCapRover(
                        svcName,
                        check.overrideYaml
                    )
                    assert.ok(
                        !redeployed.failed,
                        `Pipeline redeploy failed for ${check.name}: ${redeployed.error}`
                    )
                    assert.deepEqual(redeployed.probe.argv, check.expectedArgv)
                    console.log(
                        `PASS [pipeline redeploy]: ${check.name} -> argv=${JSON.stringify(redeployed.probe.argv)}`
                    )
                }
            } finally {
                await removeService(svcName)
            }
        }

        console.log('\n=== 3. Empirical Swarm Limitation Probes ===')
        // Probe A: Swarm ContainerSpec.Args = [] without Command -> inherits image CMD
        const probeArgsSvc = `${RUN_ID}-probe-empty-args`
        try {
            const res = await createSwarmServiceWithOverride(
                probeArgsSvc,
                imgBoth,
                yaml.stringify({
                    TaskTemplate: { ContainerSpec: { Args: [] } },
                })
            )
            assert.deepEqual(res.probe.argv, [
                'IMG_EP',
                'IMG_CMD_1',
                'IMG_CMD_2',
            ])
            console.log(
                `VERIFIED Swarm limitation: empty Args=[] without Command inherits image CMD -> argv=${JSON.stringify(res.probe.argv)}`
            )
        } finally {
            await removeService(probeArgsSvc)
        }

        // Probe B: Swarm ContainerSpec.Command = [""] without Args -> Docker fails with "no command specified"
        const probeEpSvc = `${RUN_ID}-probe-empty-ep`
        try {
            const res = await createSwarmServiceWithOverride(
                probeEpSvc,
                imgBoth,
                yaml.stringify({
                    TaskTemplate: { ContainerSpec: { Command: [''] } },
                })
            )
            assert.equal(res.failed, true)
            console.log(
                `VERIFIED Swarm limitation: Command=[""] without Args fails to start -> err=${JSON.stringify(res.error)}`
            )
        } finally {
            await removeService(probeEpSvc)
        }

        // Probe C: Native Docker Compose with command: [] (no entrypoint) on imgBoth
        const composeEmptyCmd = await runNativeCompose(
            rootDir,
            'probe-compose-empty-cmd',
            { image: imgBoth, command: [] }
        )
        console.log(
            `OBSERVED native docker compose (entrypoint omitted, command: []): argv=${JSON.stringify(composeEmptyCmd.probe.argv)}`
        )

        console.log('\nALL DOCKER & SWARM INTEGRATION CHECKS PASSED!')
    } finally {
        for (const svcName of Array.from(createdServices)) {
            await removeService(svcName)
        }
        for (const tag of createdImages) {
            try {
                dockerCli(['rmi', '-f', tag])
            } catch {
                // best effort
            }
        }
        if (initializedEphemeralSwarm) {
            try {
                dockerCli(['swarm', 'leave', '--force'])
                console.log('Left temporary local Swarm')
            } catch {
                // best effort
            }
        }
        await rm(rootDir, { recursive: true, force: true })
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
