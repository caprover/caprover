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

test('Testing  - sanitizeRepoPathSsh - name with dot', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/site.com ').repoPath
    ).toBe('ssh://git@github.com:22/owner/site.com.git')
})

test('Testing  - sanitizeRepoPathSsh - name with dot and git suffix', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/site.com.git ')
            .repoPath
    ).toBe('ssh://git@github.com:22/owner/site.com.git')
})

test('Testing  - sanitizeRepoPathSsh - name containing ".git"', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/repo.github ')
            .repoPath
    ).toBe('ssh://git@github.com:22/owner/repo.github.git')
})

test('Testing  - sanitizeRepoPathSsh - name containing ".git" and git suffix', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/repo.github.git ')
            .repoPath
    ).toBe('ssh://git@github.com:22/owner/repo.github.git')
})

test('Testing  - sanitizeRepoPathSsh - name containing ".git", git suffix and /', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/repo.github.git/ ')
            .repoPath
    ).toBe('ssh://git@github.com:22/owner/repo.github.git')
})

test('Testing  - sanitizeRepoPathSsh - not git suffix', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/repository ').repoPath
    ).toBe('ssh://git@github.com:22/owner/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - alt domain', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  git@git.alt-domain.com/owner/repository.git/ '
        ).repoPath
    ).toBe('ssh://git@git.alt-domain.com:22/owner/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - alt user', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            '  foobar@github.com/owner/repository.git/ '
        ).repoPath
    ).toBe('ssh://foobar@github.com:22/owner/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - default user', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  github.com/owner/repository.git/ ')
            .repoPath
    ).toBe('ssh://git@github.com:22/owner/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - no owner', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh('  git@github.com:repository.git/ ')
            .repoPath
    ).toBe('ssh://git@github.com:22/repository.git')
})

test('Testing  - sanitizeRepoPathSsh - invalid url', () => {
    expect(() =>
        GitHelper.sanitizeRepoPathSsh(
            '  git:password@github.com/owner/repository.git/ '
        )
    ).toThrow(Error)
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
            ' ssh://user@some.other-domain.com/owner/repository.git/ '
        )
    ).toBe('some.other-domain.com')
})
