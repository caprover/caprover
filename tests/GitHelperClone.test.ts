import * as fs from 'fs-extra'
import git from 'simple-git'
import GitHelper from '../src/utils/GitHelper'

jest.mock('child_process', () => ({
    exec: jest.fn(
        (
            _command: string,
            callback: (
                error: Error | null,
                stdout: string,
                stderr: string
            ) => void
        ) => callback(null, '', '')
    ),
}))

jest.mock('fs-extra', () => ({
    ...jest.requireActual('fs-extra'),
    ensureDir: jest.fn().mockResolvedValue(undefined),
    outputFile: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('simple-git', () => ({
    __esModule: true,
    default: jest.fn(),
}))

const mockedGit = git as jest.MockedFunction<typeof git>

function configureGitMock(raw: jest.Mock) {
    const env = jest.fn().mockReturnThis()
    mockedGit.mockReturnValue({
        env,
        raw,
    } as unknown as ReturnType<typeof git>)

    return env
}

beforeEach(() => {
    jest.clearAllMocks()
})

test('configures simple-git for SSH key deployments', async () => {
    const raw = jest.fn().mockResolvedValue('')
    const env = configureGitMock(raw)

    const result = await GitHelper.clone(
        '',
        '',
        'private key',
        'git@github.com:caprover/caprover.git',
        'master',
        '/tmp/repository'
    )

    expect(result).toBeUndefined()
    expect(mockedGit).toHaveBeenCalledWith({
        unsafe: {
            allowUnsafeSshCommand: true,
        },
    })
    expect(env).toHaveBeenCalledWith(
        'GIT_SSH_COMMAND',
        expect.stringMatching(/^ssh -i /)
    )
    expect(env.mock.invocationCallOrder[0]).toBeLessThan(
        raw.mock.invocationCallOrder[0]
    )
    expect(raw).toHaveBeenCalledWith([
        'clone',
        '--recurse-submodules',
        '-b',
        'master',
        'ssh://git@github.com:22/caprover/caprover.git',
        '/tmp/repository',
    ])

    const sshKeyPath = env.mock.calls[0][1].replace('ssh -i ', '')
    expect(fs.remove).toHaveBeenCalledWith(sshKeyPath)
})

test('removes the temporary SSH key when cloning fails', async () => {
    const cloneError = new Error('clone failed')
    const raw = jest.fn().mockRejectedValue(cloneError)
    const env = configureGitMock(raw)

    await expect(
        GitHelper.clone(
            '',
            '',
            'private key',
            'git@github.com:caprover/caprover.git',
            'master',
            '/tmp/repository'
        )
    ).rejects.toThrow('clone failed')

    const sshKeyPath = env.mock.calls[0][1].replace('ssh -i ', '')
    expect(fs.remove).toHaveBeenCalledWith(sshKeyPath)
})
