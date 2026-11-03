import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

test('creates the backmerge branch when the GitHub ref is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'caprover-backmerge-test-'))
    const mockBin = join(root, 'bin')
    const callLog = join(root, 'gh-calls.log')
    const mockGh = join(mockBin, 'gh')
    const repositoryRoot = resolve(__dirname, '..')
    const releaseConfig = await readFile(
        join(repositoryRoot, 'release/release.conf'),
        'utf8'
    )
    const version = /^CAPROVER_VERSION=(.+)$/m.exec(releaseConfig)?.[1]

    if (!version) {
        throw new Error('CAPROVER_VERSION is missing from release.conf')
    }

    const backmergeBranch = `backmerge-v${version}`

    try {
        await mkdir(mockBin)
        await writeFile(
            mockGh,
            `#!/bin/bash
set -e

printf '%s\\n' "$*" >> "$GH_CALL_LOG"

case "$1:$2" in
    api:/repos/caprover/caprover/git/matching-refs/heads/backmerge-v*)
        exit 0
        ;;
    api:/repos/caprover/caprover/git/refs)
        exit 0
        ;;
    pr:list)
        exit 0
        ;;
    pr:create)
        echo 'https://github.com/caprover/caprover/pull/1234'
        ;;
    workflow:run|pr:merge)
        exit 0
        ;;
    *)
        echo "Unexpected gh call: $*" >&2
        exit 1
        ;;
esac
`,
            { mode: 0o755 }
        )

        await execFileAsync(
            'bash',
            [join(repositoryRoot, 'release/create-backmerge-pr.sh')],
            {
                cwd: repositoryRoot,
                env: {
                    ...process.env,
                    GH_TOKEN: 'test-token',
                    GITHUB_REPOSITORY: 'caprover/caprover',
                    GITHUB_SHA: 'published-sha',
                    GH_CALL_LOG: callLog,
                    PATH: `${mockBin}:${process.env.PATH ?? ''}`,
                },
            }
        )

        const calls = await readFile(callLog, 'utf8')

        expect(calls).toContain(
            `api /repos/caprover/caprover/git/matching-refs/heads/${backmergeBranch}`
        )
        expect(calls).toContain(
            'api /repos/caprover/caprover/git/refs --method POST'
        )
        expect(calls).toContain(
            `pr create --repo caprover/caprover --base master --head ${backmergeBranch}`
        )
        expect(calls).not.toContain(`git/ref/heads/${backmergeBranch}`)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
})
