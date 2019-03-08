import { AnyError } from '../models/OtherTypes'
import Utils from './Utils'
import * as CaptainConstants from './CaptainConstants'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as git from 'simple-git/promise'
import * as uuid from 'uuid'

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

        const remote = `https://${USER}:${PASS}@${REPO}`

        if (!!sshKey) {
            const SSH_KEY_PATH = path.join(
                CaptainConstants.captainRootDirectoryTemp,
                uuid.v4()
            )
            return Promise.resolve() //
                .then(function() {
                    fs.outputFile(SSH_KEY_PATH, sshKey + '')
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
            return git() //
                .silent(true) //
                .raw(['clone', '--recursive', '-b', branch, remote, directory])
                .then(function() {})
        }
    }
}

export = GitHelper
