// Requires `npm ci`, `npm run build`, and a local Docker daemon with Swarm active
// (or pass `--ephemeral-swarm` on a disposable host to init/leave Swarm automatically).
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdir, mkdtemp, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const Docker = require('dockerode')
const yaml = require('yaml')

const {
    default: DockerComposeToServiceOverride,
    DOCKER_COMPOSE_TEMPLATE_NAME,
    resolveComposeExecutionSemantics,
} = require('../built/utils/DockerComposeToServiceOverride')
const Utils = require('../built/utils/Utils').default

const BASE_IMAGE = 'node:24-alpine'
const RUN_ID = `caprover-cmdtest-${Date.now().toString(36)}`
const ALLOW_EPHEMERAL_SWARM = process.argv.includes('--ephemeral-swarm')
const PROBE_SCRIPT = `#!/usr/bin/env node
console.log(JSON.stringify({ argv: process.argv.slice(2) }))
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
setTimeout(() => process.exit(0), 60000)
`

const docker = new Docker()
const createdServices = new Set()
const createdImages = []

const dockerCli = (args) =>
    execFileSync('docker', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 120000,
    }).trim()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const serviceNameFor = (suffix) =>
    `${RUN_ID}-${suffix}`.slice(0, 60).replace(/-+$/, '')

const escapeComposeInterpolation = (value) => {
    if (typeof value === 'string') return value.replace(/\$/g, () => '$$')
    if (Array.isArray(value)) return value.map(escapeComposeInterpolation)
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

async function buildTestImage(rootDir, name, dockerfileLines) {
    const tag = `${name}:${RUN_ID}`
    const dir = join(rootDir, name)
    await mkdir(dir, { recursive: true })
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

function inspectAndParseProbe(containerId, logs) {
    const jsonLine = logs
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.startsWith('{'))
    assert.ok(jsonLine, `Missing probe JSON in logs: ${JSON.stringify(logs)}`)
    const inspected = JSON.parse(dockerCli(['inspect', containerId]))[0]
    return {
        path: inspected.Path,
        args: inspected.Args,
        argv: JSON.parse(jsonLine).argv,
    }
}

async function runNativeCompose(rootDir, caseName, serviceDef) {
    const dir = join(rootDir, `compose-${caseName}`)
    await mkdir(dir, { recursive: true })
    const projectName = `${RUN_ID}-${caseName}`.replace(/[^a-z0-9_-]/g, '')
    const composeFile = join(dir, 'compose.yml')
    await writeFile(
        composeFile,
        yaml.stringify({
            services: {
                app: {
                    ...escapeComposeInterpolation(serviceDef),
                    environment: { TEST_VAR: 'from-container-env' },
                },
            },
        })
    )
    const baseArgs = ['compose', '-f', composeFile, '-p', projectName]
    try {
        dockerCli([...baseArgs, 'up', '-d'])
        const containerId = dockerCli([...baseArgs, 'ps', '-q', 'app'])
        assert.ok(containerId, `No compose container started for ${caseName}`)
        let logs = ''
        for (let attempt = 0; attempt < 40; attempt++) {
            logs = dockerCli(['logs', containerId])
            if (logs.includes('"argv"')) break
            await sleep(250)
        }
        return inspectAndParseProbe(containerId, logs)
    } finally {
        try {
            dockerCli([
                ...baseArgs,
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
    let lastTask
    while (Date.now() < deadline) {
        const tasks = (
            await docker.listTasks({ filters: { service: [serviceName] } })
        )
            .filter((t) =>
                (t.Spec?.ContainerSpec?.Env || []).includes(expectedEnvMarker)
            )
            .sort((a, b) => (b.Version?.Index || 0) - (a.Version?.Index || 0))

        for (const task of tasks) {
            lastTask = task
            const state = task.Status?.State
            const containerId = task.Status?.ContainerStatus?.ContainerID
            if (containerId && (state === 'running' || state === 'complete')) {
                const logs = dockerCli(['logs', containerId])
                if (logs.includes('"argv"')) {
                    return inspectAndParseProbe(containerId, logs)
                }
            }
            if (state === 'failed' || state === 'rejected') {
                return {
                    failed: true,
                    error: task.Status?.Err || task.Status?.Message || state,
                }
            }
        }
        await sleep(300)
    }
    throw new Error(
        `Timed out waiting for ${serviceName}; last state=${lastTask?.Status?.State} err=${lastTask?.Status?.Err}`
    )
}

async function runSwarmService(name, image, overrideYaml, verifyRedeploy) {
    const env = ['TEST_VAR=from-container-env']
    const baseSpec = {
        Name: name,
        TaskTemplate: {
            ContainerSpec: { Image: image, Env: env },
            RestartPolicy: { Condition: 'none' },
        },
        Mode: { Replicated: { Replicas: 1 } },
    }
    const parsedOverride = Utils.convertYamlOrJsonToObject(overrideYaml)
    await docker.createService(Utils.mergeObjects(baseSpec, parsedOverride))
    createdServices.add(name)

    try {
        const initial = await waitForSwarmTask(name, env[0])
        if (!verifyRedeploy || initial.failed) return { initial }

        const service = docker.getService(name)
        const inspected = JSON.parse(JSON.stringify(await service.inspect()))
        const updatedSpec = inspected.Spec
        updatedSpec.version = parseInt(inspected.Version.Index, 10)
        updatedSpec.TaskTemplate.ContainerSpec.Env = [...env, 'REDEPLOY_GEN=2']
        updatedSpec.TaskTemplate.ForceUpdate =
            (updatedSpec.TaskTemplate.ForceUpdate || 0) + 1
        await service.update(Utils.mergeObjects(updatedSpec, parsedOverride))
        const redeployed = await waitForSwarmTask(name, 'REDEPLOY_GEN=2')
        return { initial, redeployed }
    } finally {
        try {
            await docker.getService(name).remove()
        } catch {
            // best effort
        }
        createdServices.delete(name)
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
                `Swarm is "${initialSwarmState}". Re-run on a Swarm node or pass --ephemeral-swarm.`
            )
        }
        dockerCli(['swarm', 'init', '--advertise-addr', '127.0.0.1'])
        initializedEphemeralSwarm = true
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
            [
                'omitted-img-both',
                { image: imgBoth },
                ['IMG_EP', 'IMG_CMD_1', 'IMG_CMD_2'],
            ],
            ['omitted-img-cmd-only', { image: imgCmdOnly }, ['IMG_CMD_ONLY']],
            ['omitted-img-ep-only', { image: imgEpOnly }, ['IMG_EP_ONLY']],
            [
                'null-both',
                { image: imgBoth, entrypoint: null, command: null },
                ['IMG_EP', 'IMG_CMD_1', 'IMG_CMD_2'],
            ],
            [
                'cmd-array',
                {
                    image: imgBoth,
                    command: ['arg one', '', '$TEST_VAR', 'a && b'],
                },
                ['IMG_EP', 'arg one', '', '$TEST_VAR', 'a && b'],
            ],
            [
                'cmd-string-quoting',
                {
                    image: imgBoth,
                    command:
                        'plain "two words" \'\' foo\\ bar --k="v 1" \'$TEST_VAR\'',
                },
                [
                    'IMG_EP',
                    'plain',
                    'two words',
                    '',
                    'foo bar',
                    '--k=v 1',
                    '$TEST_VAR',
                ],
            ],
            [
                'cmd-replaces-cmd-only',
                {
                    image: imgCmdOnly,
                    command: ['/usr/local/bin/probe', 'REPLACED_CMD'],
                },
                ['REPLACED_CMD'],
            ],
            [
                'ep-only-suppresses-cmd',
                {
                    image: imgBoth,
                    entrypoint: ['/usr/local/bin/probe', 'NEW_EP'],
                },
                ['NEW_EP'],
            ],
            [
                'ep-and-empty-cmd-array',
                {
                    image: imgBoth,
                    entrypoint: ['/usr/local/bin/probe', 'NEW_EP'],
                    command: [],
                },
                ['NEW_EP'],
            ],
            [
                'ep-and-empty-cmd-str',
                {
                    image: imgBoth,
                    entrypoint: '/usr/local/bin/probe NEW_EP',
                    command: '',
                },
                ['NEW_EP'],
            ],
            [
                'ep-and-cmd-shell',
                {
                    image: imgBoth,
                    entrypoint: ['/bin/sh', '-ec'],
                    command: [
                        'exec /usr/local/bin/probe "hello $TEST_VAR" "" "a && b"',
                    ],
                },
                ['hello from-container-env', '', 'a && b'],
            ],
            [
                'clear-ep-array-with-cmd',
                {
                    image: imgBoth,
                    entrypoint: [],
                    command: ['/usr/local/bin/probe', 'DIRECT_EXEC', 'arg2'],
                },
                ['DIRECT_EXEC', 'arg2'],
            ],
            [
                'clear-ep-str-with-cmd',
                {
                    image: imgEpOnly,
                    entrypoint: '',
                    command: '/usr/local/bin/probe "CLEARED EP" \'\'',
                },
                ['CLEARED EP', ''],
            ],
        ]

        console.log(
            '\n=== 1. Native Docker Compose vs Swarm (Standard Semantics) ==='
        )
        for (const [name, service, expectedArgv] of equivalenceCases) {
            const composeRes = await runNativeCompose(rootDir, name, service)
            const overrideYaml =
                DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                    service,
                    'standard',
                    `services.${name}`
                )
            const { initial: swarmRes } = await runSwarmService(
                serviceNameFor(name),
                service.image,
                overrideYaml,
                false
            )
            assert.ok(
                !swarmRes.failed,
                `Swarm failed for ${name}: ${swarmRes.error}`
            )
            assert.deepEqual(composeRes.argv, expectedArgv)
            assert.deepEqual(swarmRes.argv, composeRes.argv)
            assert.equal(swarmRes.path, composeRes.path)
            assert.deepEqual(swarmRes.args, composeRes.args)
            console.log(
                `PASS [compose == swarm]: ${name} -> argv=${JSON.stringify(swarmRes.argv)}`
            )
        }

        console.log(
            '\n=== 2. CapRover Legacy v4 vs Standard v5 vs Direct Compose + Redeploy ==='
        )
        const semanticsCases = [
            [
                'legacy-v4-array',
                4,
                'OFFICIAL_TEST',
                {
                    image: imgBoth,
                    entrypoint: ['/bin/ignored'],
                    command: ['/usr/local/bin/probe', 'LEGACY_ARR'],
                },
                ['LEGACY_ARR'],
                true,
            ],
            [
                'legacy-v4-string',
                4,
                'OFFICIAL_TEST',
                {
                    image: imgBoth,
                    command: '/usr/local/bin/probe "LEGACY STR"',
                },
                ['LEGACY STR'],
                false,
            ],
            [
                'standard-v5-shell',
                5,
                'OFFICIAL_TEST',
                {
                    image: imgBoth,
                    entrypoint: ['/bin/sh', '-ec'],
                    command: ['exec /usr/local/bin/probe "V5 $TEST_VAR"'],
                },
                ['V5 from-container-env'],
                true,
            ],
            [
                'direct-compose-v4',
                4,
                DOCKER_COMPOSE_TEMPLATE_NAME,
                { image: imgBoth, command: ['FROM_COMPOSE_ARGS'] },
                ['IMG_EP', 'FROM_COMPOSE_ARGS'],
                true,
            ],
        ]
        for (const [
            name,
            version,
            templateName,
            service,
            expectedArgv,
            redeploy,
        ] of semanticsCases) {
            const semantics = resolveComposeExecutionSemantics(
                version,
                templateName
            )
            const overrideYaml =
                DockerComposeToServiceOverride.convertUnconsumedComposeParametersToServiceOverride(
                    service,
                    semantics,
                    `services.${name}`
                )
            const { initial, redeployed } = await runSwarmService(
                serviceNameFor(`sem-${name}`),
                service.image,
                overrideYaml,
                redeploy
            )
            assert.ok(
                !initial.failed,
                `Deploy failed for ${name}: ${initial.error}`
            )
            assert.deepEqual(initial.argv, expectedArgv)
            if (redeploy) {
                assert.ok(
                    !redeployed.failed,
                    `Redeploy failed for ${name}: ${redeployed.error}`
                )
                assert.deepEqual(redeployed.argv, expectedArgv)
            }
            console.log(
                `PASS [${semantics}${redeploy ? ' + redeploy' : ''}]: ${name} -> argv=${JSON.stringify(initial.argv)}`
            )
        }

        console.log('\n=== 3. Empirical Swarm Limitation Probes ===')
        const emptyArgs = (
            await runSwarmService(
                serviceNameFor('probe-empty-args'),
                imgBoth,
                yaml.stringify({
                    TaskTemplate: { ContainerSpec: { Args: [] } },
                }),
                false
            )
        ).initial
        assert.deepEqual(emptyArgs.argv, ['IMG_EP', 'IMG_CMD_1', 'IMG_CMD_2'])
        console.log(
            `VERIFIED empty Args=[] inherits image CMD -> argv=${JSON.stringify(emptyArgs.argv)}`
        )

        const emptyEp = (
            await runSwarmService(
                serviceNameFor('probe-empty-ep'),
                imgBoth,
                yaml.stringify({
                    TaskTemplate: { ContainerSpec: { Command: [''] } },
                }),
                false
            )
        ).initial
        assert.equal(emptyEp.failed, true)
        console.log(
            `VERIFIED Command=[""] without Args fails -> err=${JSON.stringify(emptyEp.error)}`
        )

        const composeEmptyCmd = await runNativeCompose(
            rootDir,
            'probe-compose-empty-cmd',
            {
                image: imgBoth,
                command: [],
            }
        )
        console.log(
            `OBSERVED native docker compose (command: [] only) -> argv=${JSON.stringify(composeEmptyCmd.argv)}`
        )

        console.log('\nALL DOCKER & SWARM INTEGRATION CHECKS PASSED!')
    } finally {
        for (const svcName of Array.from(createdServices)) {
            try {
                await docker.getService(svcName).remove()
            } catch {
                // best effort
            }
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
