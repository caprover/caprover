import * as childPross from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as git from 'simple-git/promise'
import * as util from 'util'
import * as uuid from 'uuid'
import CaptainConstants from './CaptainConstants'
import Logger from './Logger'
import Utils from './Utils'
const exec = util.promisify(childPross.exec)

export default class GitHelper {
    static #SSH_PATH_RE = new RegExp(
        [
            /^\s*/,
            /(?:(?<proto>[a-z]+):\/\/)?/,
            /(?:(?<user>[a-z_][a-z0-9_-]+)@)?/,
            /(?<domain>[^\s\/\?#:]+)/,
            /(?::(?<port>[0-9]{1,5}))?/,
            /(?:[\/:](?<owner>[^\s\/\?#:]+))?/,
            /(?:[\/:](?<repo>[^\s\/\?#:.]+))/,
            /(?:.git)?\/?\s*$/,
        ]
            .map((r) => r.source)
            .join(''),
        'i'
    )

    static getLastHash(directory: string) {
        return git(directory) //
            .silent(true) //
            .raw(['rev-parse', 'HEAD']) //
    }

    static clone(
        username: string,
        pass: string,
        sshKey: string,
        repo: string,
        branch: string,
        directory: string
    ) {
        const USER = encodeURIComponent(username)
        const PASS = encodeURIComponent(pass)

        if (sshKey) {
            const SSH_KEY_PATH = path.join(
                CaptainConstants.captainRootDirectoryTemp,
                uuid.v4()
            )

            const sanitized = GitHelper.sanitizeRepoPathSsh(repo)
            const REPO_GIT_PATH = sanitized.repoPath
            const SSH_PORT = sanitized.port

            const DOMAIN =
                GitHelper.getDomainFromSanitizedSshRepoPath(REPO_GIT_PATH)

            Logger.d(`Cloning SSH ${REPO_GIT_PATH}`)

            return Promise.resolve() //
                .then(function () {
                    return fs.outputFile(SSH_KEY_PATH, sshKey + '')
                })
                .then(function () {
                    return exec(`chmod 600 ${SSH_KEY_PATH}`)
                })
                .then(function () {
                    return fs.ensureDir('/root/.ssh')
                })
                .then(function () {
                    return exec(
                        `ssh-keyscan -p ${SSH_PORT} -H ${DOMAIN} >> /root/.ssh/known_hosts`
                    )
                })
                .then(function () {
                    return git() //
                        .silent(true) //
                        .env('GIT_SSH_COMMAND', `ssh -i ${SSH_KEY_PATH}`) //
                        .raw([
                            'clone',
                            '--recursive',
                            '-b',
                            branch,
                            REPO_GIT_PATH,
                            directory,
                        ])
                })
                .then(function () {
                    return fs.remove(SSH_KEY_PATH)
                })
        } else {
            // Some people put https when they are entering their git information
            const REPO_PATH = GitHelper.sanitizeRepoPathHttps(repo)

            // respect the explicit http repo path
            const SCHEME = repo.startsWith('http://') ? 'http' : 'https'

            const remote = `${SCHEME}://${USER}:${PASS}@${REPO_PATH}`
            Logger.dev(`Cloning HTTPS ${remote}`)
            return git() //
                .silent(true) //
                .raw(['clone', '--recursive', '-b', branch, remote, directory])
                .then(function () {
                    //
                })
        }
    }

    // input is like this: ssh://git@github.com:22/caprover/caprover-cli.git
    static getDomainFromSanitizedSshRepoPath(input: string) {
        return GitHelper.sanitizeRepoPathSsh(input).domain
    }

    // It returns a string like this "github.com/username/repository.git"
    static sanitizeRepoPathHttps(input: string) {
        input = Utils.removeHttpHttps(input)

        if (input.toLowerCase().startsWith('git@')) {
            // at this point, input is like git@github.com:caprover/caprover-cli.git
            input = input.substring(4)
            input = input.replace(':', '/')
        }

        return input.replace(/\/$/, '')
    }

    // It returns a string like this "ssh://git@github.com:22/caprover/caprover-cli.git"
    static sanitizeRepoPathSsh(input: string) {
        const found = input.match(GitHelper.#SSH_PATH_RE)
        if (!found) {
            throw new Error(`Malformatted SSH path: ${input}`)
        }

        return {
            user: found.groups?.user ?? 'git',
            domain: found.groups?.domain,
            port: Number(found.groups?.port ?? 22),
            owner: found.groups?.owner ?? '',
            repo: found.groups?.repo,
            get repoPath() {
                return `ssh://${this.user}@${this.domain}:${this.port}/${
                    this.owner
                }${this.owner && '/'}${this.repo}.git`
            },
        }
    }
}
