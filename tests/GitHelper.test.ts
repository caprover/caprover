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

test('Testing  - sanitizeRepoPathSsh - with extra path components', () => {
    const sanitized = GitHelper.sanitizeRepoPathSsh(
        ' git@gitlab.com/test1/test2/test3.git'
    );
    expect(sanitized).toEqual({
        domain: "gitlab.com",
        owner: "test1",
        port: 22,
        repo: "test2/test3",
        repoPath: "ssh://git@gitlab.com:22/test1/test2/test3.git",
        suffix: ".git",
        user: "git",
    })
})

test('Testing  - sanitizeRepoPathSsh - port', () => {
    expect(
        GitHelper.sanitizeRepoPathSsh(
            ' git@github.com:username/repository.git/  '
        ).port
    ).toBe(22)
})

test('Testing  - sanitizeRepoPathSsh - custom port', () => {
    const sanitized = GitHelper.sanitizeRepoPathSsh(
        ' git@github.com:1234/username/repository.git/  '
    )
    expect(sanitized).toEqual({
        user: "git",
        domain: "github.com",
        owner: "username",
        port: 1234,
        repo: "repository",
        suffix: ".git",
        repoPath: "ssh://git@github.com:1234/username/repository.git",
    })
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
    ).toBe('ssh://git@github.com:22/owner/site.com')
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
    ).toBe('ssh://git@github.com:22/owner/repo.github')
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
    ).toBe('ssh://git@github.com:22/owner/repository')
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

test('Testing  - sanitizeRepoPathSsh - with extra path components separated by column', () => {
    const sanitized = GitHelper.sanitizeRepoPathSsh(
        '  git@ssh.dev.azure.com:v3/myOrg/My%20Project%20Name/my-repo-name '
    )
    expect(sanitized).toEqual({
        user: 'git',
        domain: 'ssh.dev.azure.com',
        port: 22,
        owner: 'v3',
        repo: "myOrg/My%20Project%20Name/my-repo-name",
        repoPath: "ssh://git@ssh.dev.azure.com:22/v3/myOrg/My%20Project%20Name/my-repo-name",
        suffix: "",
    })
})

test('Testing  - sanitizeRepoPathSsh - with extra path components and port separated by column', () => {
    const sanitized = GitHelper.sanitizeRepoPathSsh(
        '  git@ssh.dev.azure.com:422:v3/myOrg/My%20Project%20Name/my-repo-name '
    )
    expect(sanitized).toEqual({
        user: "git",
        domain: 'ssh.dev.azure.com',
        owner: "v3",
        port: 422,
        repo: "myOrg/My%20Project%20Name/my-repo-name",
        repoPath: "ssh://git@ssh.dev.azure.com:422/v3/myOrg/My%20Project%20Name/my-repo-name",
        suffix: "",
    })
})

test('Testing  - sanitizeRepoPathSsh - with extra path components and "owner" instead of "git" user', () => {
    const sanitized = GitHelper.sanitizeRepoPathSsh(
        '  myOrg@vs-ssh.visualstudio.com:v3/myOrg/My%20Project%20Name/my-repo-name '
    )
    expect(sanitized).toEqual({
        user: 'myOrg',
        domain: 'vs-ssh.visualstudio.com',
        port: 22,
        owner: "v3",
        repo: "myOrg/My%20Project%20Name/my-repo-name",
        repoPath: "ssh://myOrg@vs-ssh.visualstudio.com:22/v3/myOrg/My%20Project%20Name/my-repo-name",
        suffix: "",
    })
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

test('Testing  - getDomainFromSanitizedSshRepoPath - with extra path components separated by column', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                '  git@ssh.dev.azure.com:422:v3/myOrg/My%20Project%20Name/my-repo-name '
            ).repoPath
        )
    ).toBe('ssh.dev.azure.com')
})

test('Testing  - getDomainFromSanitizedSshRepoPath - with extra path components separated by column and "owner" instead of "git" user', () => {
    expect(
        GitHelper.getDomainFromSanitizedSshRepoPath(
            GitHelper.sanitizeRepoPathSsh(
                '  myOrg@vs-ssh.visualstudio.com:v3/myOrg/My%20Project%20Name/my-repo-name '
            ).repoPath
        )
    ).toBe('vs-ssh.visualstudio.com')
})
