// Requires `npm ci`, `npm run build`, and a local Docker daemon.
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { mkdtemp, mkdir, rm, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join, resolve } = require('node:path')

// Match the Node.js runtime used by release/dockerfile.release.
const IMAGE = 'node:24-alpine'
const SAMPLE_DRIFT_BYTES = 64 * 1024 * 1024

const collectInContainer = `
const assert = require('node:assert/strict')
// Only Swarm identity/version metadata is stubbed. getDiskUsage() and statfs()
// run unchanged against the real host bind mount inside this container.
const Docker = require('dockerode')
Docker.prototype.version = async () => ({ ApiVersion: '1.52' })
require('./built/utils/Logger').default.d = () => {}
const constants = require('./built/utils/CaptainConstants').default
assert.equal(constants.captainBaseDirectory, process.env.DISK_SMOKE_EXPECTED_PATH)
const CaptainManager = require('./built/user/system/CaptainManager').default
const manager = Object.create(CaptainManager.prototype)
manager.getMyNodeId = () => 'smoke-node'
manager.getNodesInfo = async () => [{ nodeId: 'smoke-node', hostname: 'smoke-host' }]
manager.getDiskUsage().then(data => {
    console.log(JSON.stringify(data))
}).catch(error => {
    console.error(error)
    process.exitCode = 1
})
`

async function main() {
    const repo = resolve(__dirname, '..')
    const root = await mkdtemp(join(tmpdir(), 'caprover-disk-bind-'))
    try {
        const source = join(root, 'captain')
        await mkdir(source)
        // This file is outside the directory exposed to the container, but its
        // usage contributes to the same host filesystem's capacity counters.
        await writeFile(
            join(root, 'outside-captain'),
            Buffer.alloc(8 * 1024 * 1024, 1)
        )

        for (const target of ['/captain', '/custom-captain']) {
            const args = [
                'run',
                '--rm',
                '--network',
                'none',
                '--mount',
                `type=bind,source=${repo},target=/app,readonly`,
                '--mount',
                `type=bind,source=${source},target=${target},readonly`,
                '--workdir',
                '/app',
                '--env',
                `DISK_SMOKE_EXPECTED_PATH=${target}`,
            ]
            if (target !== '/captain') {
                args.push('--env', `CAPTAIN_BASE_DIRECTORY=${target}`)
            }
            args.push(IMAGE, 'node', '-e', collectInContainer)
            const output = execFileSync('docker', args, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'inherit'],
                timeout: 120000,
            })
            const data = JSON.parse(output)
            const disk = data.nodes[0].disks[0]
            const hostValues = execFileSync(
                'df',
                ['-B1', '--output=size,used,avail', source],
                {
                    encoding: 'utf8',
                }
            )
                .trim()
                .split('\n')
                .at(-1)
                .trim()
                .split(/\s+/)
                .map(Number)

            assert.equal(data.coverage, 'captain-node')
            assert.equal(disk.totalBytes, hostValues[0])
            // The host filesystem remains active between the two samples.
            assert.ok(
                Math.abs(disk.usedBytes - hostValues[1]) <= SAMPLE_DRIFT_BYTES
            )
            assert.ok(
                Math.abs(disk.availableBytes - hostValues[2]) <=
                    SAMPLE_DRIFT_BYTES
            )
            assert.ok(disk.usedBytes >= 8 * 1024 * 1024)
            console.log(
                `PASS: ${target} bind-mount capacity agrees with host df`
            )
        }
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
