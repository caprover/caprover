import GitHelper from '../src/utils/GitHelper'

test('Testing  - sanitizeRepoPathHttps', () => {
    expect(
        GitHelper.sanitizeRepoPathHttps(
            '  https://github.com/username/repository.git/ '
        )
    ).toBe('github.com/username/repository.git')
})

test('Testing  - sanitizeRepoPathHttps from SSH', () => {
    expect(
        GitHelper.sanitizeRepoPathHttps(
            ' git@github.com/username/repository.git/  '
        )
    ).toBe('github.com/username/repository.git')
})

test('Testing  - sanitizeRepoPathSsh', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            ' git@github.com:username/repository.git/  '
        )
    ).toBe('git@github.com:username/repository.git')
})

test('Testing  - sanitizeRepoPathSsh from HTTPS', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  https://github.com/username/repository.git/ '
        )
    ).toBe('git@github.com:username/repository.git')
})

test('Testing  - getDomainFromSanitizedSshRepoPath - pure', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            'git@github.com:username/repository.git'
        )
    ).toBe('github.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                ' git@github.com:username/repository.git/  '
            )
        )
    ).toBe('github.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath from HTTPS', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                '  https://github.com/username/repository.git/ '
            )
        )
    ).toBe('github.com')
})
