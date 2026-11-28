import { execFileSync } from 'child_process'
import * as fs from 'fs-extra'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import GitHelper from '../src/utils/GitHelper'

const SECRET = 's3cret-pass'

function git(cwd: string, ...args: string[]) {
    execFileSync(
        'git',
        [
            '-c',
            'user.name=test',
            '-c',
            'user.email=test@example.com',
            '-c',
            'protocol.file.allow=always',
            ...args,
        ],
        { cwd, stdio: 'ignore' }
    )
}

function filesContaining(directory: string, text: string): string[] {
    return fs
        .readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(entry.parentPath, entry.name))
        .filter((file) => fs.readFileSync(file).includes(text))
}

describe('GitHelper HTTPS clone', () => {
    let root: string
    let environment: NodeJS.ProcessEnv

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(tmpdir(), 'caprover-git-clone-'))
        const server = path.join(root, 'server')

        // A repository with a submodule at a relative URL, which git resolves against the
        // superproject's remote, credentials included.
        git(root, 'init', '-q', '--bare', '-b', 'main', 'server/lib.git')
        git(root, 'init', '-q', '--bare', '-b', 'main', 'server/app.git')
        git(root, 'init', '-q', '-b', 'main', 'lib')
        await fs.outputFile(path.join(root, 'lib', 'lib.txt'), 'lib')
        git(path.join(root, 'lib'), 'add', '.')
        git(path.join(root, 'lib'), 'commit', '-q', '-m', 'lib')
        git(
            path.join(root, 'lib'),
            'push',
            '-q',
            path.join(server, 'lib.git'),
            'main'
        )
        git(root, 'init', '-q', '-b', 'main', 'app')
        git(
            path.join(root, 'app'),
            'remote',
            'add',
            'origin',
            path.join(server, 'app.git')
        )
        git(
            path.join(root, 'app'),
            'submodule',
            'add',
            '-q',
            '../lib.git',
            'lib'
        )
        git(path.join(root, 'app'), 'commit', '-q', '-m', 'app')
        git(path.join(root, 'app'), 'push', '-q', 'origin', 'main')

        // Git fetches https://git.example.com/ from the local server, but stores the URL as given.
        // simple-git drops GIT_* variables, so the setting goes in the global config of a new HOME.
        await fs.outputFile(
            path.join(root, 'home', '.gitconfig'),
            [
                `[url "${server}/"]`,
                `\tinsteadOf = https://user:${SECRET}@git.example.com/`,
                '[protocol "file"]',
                '\tallow = always',
                '',
            ].join('\n')
        )
        environment = process.env
        process.env = { ...environment, HOME: path.join(root, 'home') }
    })

    afterEach(async () => {
        process.env = environment
        await fs.remove(root)
    })

    test('leaves no credentials in the cloned repository or its submodules', async () => {
        const directory = path.join(root, 'clone')

        await GitHelper.clone(
            'user',
            SECRET,
            '',
            'https://git.example.com/app.git',
            'main',
            directory
        )

        expect(
            await fs.readFile(path.join(directory, 'lib', 'lib.txt'), 'utf8')
        ).toBe('lib')
        expect(filesContaining(directory, SECRET)).toEqual([])
        expect(
            execFileSync('git', ['remote', 'get-url', 'origin'], {
                cwd: path.join(directory, 'lib'),
            }).toString()
        ).toBe('https://git.example.com/lib.git\n')
    })
})
