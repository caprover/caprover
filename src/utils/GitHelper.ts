import { AnyError } from '../models/OtherTypes'
import Utils from './Utils'
import CaptainConstants from './CaptainConstants'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as git from 'simple-git/promise'
import * as uuid from 'uuid'
import Logger from './Logger'
import * as util from 'util'
import * as childPross from 'child_process'
const exec = util.promisify(childPross.exec)

export default class GitHelper {
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

        if (!!sshKey) {
            const SSH_KEY_PATH = path.join(
                CaptainConstants.captainRootDirectoryTemp,
                uuid.v4()
            )

            const sanitized = GitHelper.sanitizeRepoPathSsh(repo)
            const REPO_GIT_PATH = sanitized.repoPath
            const SSH_PORT = sanitized.port

            const DOMAIN = GitHelper.getDomainFromSanitizedSshRepoPath(
                REPO_GIT_PATH
            )

            Logger.d('Cloning SSH ' + REPO_GIT_PATH)

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
                        .env('GIT_SSH_COMMAND', 'ssh -i ' + SSH_KEY_PATH) //
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

            const remote = `https://${USER}:${PASS}@${REPO_PATH}`
            Logger.dev('Cloning HTTPS ' + remote)
            return git() //
                .silent(true) //
                .raw(['clone', '--recursive', '-b', branch, remote, directory])
                .then(function () {})
        }
    }

    // input is like this: ssh://git@github.com:22/caprover/caprover-cli.git
    static getDomainFromSanitizedSshRepoPath(input: string) {
        input = input.substring(10)
        return input.substring(0, input.indexOf(':'))
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
        input = Utils.removeHttpHttps(input)
        if (!input.startsWith('git@')) {
            // If we get here, we have something like github.com/username/repository.git
            input = input.replace('/', ':')
            input = 'git@' + input
        }

        // At this point we have one of the following:
        // git@github.com:22/caprover/caprover
        // git@github.com:caprover/caprover

        let port = '22'
        const split = input.split(':')
        if (split.length == 2) {
            const secondSplit = split[1].split('/')
            if (`${Number(secondSplit[0])}` === secondSplit[0]) {
                // input is already in this format: git@github.com:22/caprover/caprover
                port = `${Number(secondSplit[0])}`
            } else {
                input = split[0] + ':22/' + split[1]
            }
        } else {
            throw new Error('Marformatted SSH path: ' + input)
        }

        if (!input.toLowerCase().startsWith('ssh://')) {
            input = 'ssh://' + input
        }

        return {
            repoPath: input.replace(/\/$/, ''),
            port: port,
        }
    }
}
