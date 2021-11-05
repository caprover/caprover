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
        ).repoPath
    ).toBe('ssh://git@github.com:22/username/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - port', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            ' git@github.com:username/repository.git/  '
        ).port
    ).toBe(22)
})

test('Testing  - sanitizeRepoPathSsh - custom port', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            ' git@github.com:1234/username/repository.git/  '
        ).port
    ).toBe(1234)
})

test('Testing  - sanitizeRepoPathSsh from HTTPS', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  https://github.com/username/repository.git/ '
        ).repoPath
    ).toBe('ssh://git@github.com:22/username/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - alt domain', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  https://gitea@git.alt-domain.com:2221/username/repository/ '
        ).repoPath
    ).toBe('ssh://gitea@git.alt-domain.com:2221/username/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - no owner', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  foo@git.alt-domain.com:repository.git '
        ).repoPath
    ).toBe('ssh://foo@git.alt-domain.com:22/repository.git')
})

test('Testing  - getDomainFromSanitizedSshRepoPath - pure', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            'ssh://git@github.com:132/username/repository.git'
        )
    ).toBe('github.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                ' git@github.com:username/repository.git/  '
            ).repoPath
        )
    ).toBe('github.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath from HTTPS', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                '  https://github.com/username/repository.git/ '
            ).repoPath
        )
    ).toBe('github.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath - alt domain', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            ' ssh://user@some.do-main.com/owner/repository.git/ '
        )
    ).toBe('some.do-main.com')
})