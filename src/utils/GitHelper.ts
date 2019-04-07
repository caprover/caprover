import { AnyError } from '../models/OtherTypes'
import Utils from './Utils'
import * as CaptainConstants from './CaptainConstants'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as git from 'simple-git/promise'
import * as uuid from 'uuid'
import Logger = require('./Logger')
import * as util from 'util'
import * as childPross from 'child_process'
const exec = util.promisify(childPross.exec)

class GitHelper {
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

        // Some people put https when they are entering their git information
        const REPO = Utils.removeHttpHttps(repo)

        if (!!sshKey) {
            const SSH_KEY_PATH = path.join(
                CaptainConstants.captainRootDirectoryTemp,
                uuid.v4()
            )

            const indexOfSlash = REPO.indexOf('/')
            const DOMAIN = REPO.substring(0, indexOfSlash)
            const REPO_WITHOUT_DOMAIN = REPO.substring(
                indexOfSlash + 1,
                REPO.length
            ).replace(/\/$/, '')

            const remote = `git@${DOMAIN}:${REPO_WITHOUT_DOMAIN}.git`

            Logger.dev('Cloning SSH ' + remote)

            return Promise.resolve() //
                .then(function() {
                    return fs.outputFile(SSH_KEY_PATH, sshKey + '')
                })
                .then(function() {
                    return exec(
                        `chmod 600 ${SSH_KEY_PATH}`
                    )
                })
                .then(function() {
                    return fs.ensureDir('/root/.ssh')
                })
                .then(function() {
                    return exec(
                        `ssh-keyscan -H ${DOMAIN} >> /root/.ssh/known_hosts`
                    )
                })
                .then(function() {
                    return git() //
                        .silent(true) //
                        .env('GIT_SSH_COMMAND', 'ssh -i ' + SSH_KEY_PATH) //
                        .raw([
                            'clone',
                            '--recursive',
                            '-b',
                            branch,
                            remote,
                            directory,
                        ])
                })
                .then(function() {
                    return fs.remove(SSH_KEY_PATH)
                })
        } else {
            const remote = `https://${USER}:${PASS}@${REPO}`
            Logger.dev('Cloning HTTPS ' + remote)
            return git() //
                .silent(true) //
                .raw(['clone', '--recursive', '-b', branch, remote, directory])
                .then(function() {})
        }
    }
}

export = GitHelper
