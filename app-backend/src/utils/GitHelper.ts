import { AnyError } from '../models/OtherTypes'

const git = require('simple-git')

class GitHelper {
    static getLastHash(directory: string) {
        return new Promise<string>(function(resolve, reject) {
            git(directory)
                .silent(true)
                .raw(['rev-parse', 'HEAD'], function(
                    err: AnyError,
                    result: string
                ) {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(result)
                    }
                })
        })
    }

    static clone(
        username: string,
        pass: string,
        repo: string,
        branch: string,
        directory: string
    ) {
        const USER = encodeURIComponent(username)
        const PASS = encodeURIComponent(pass)

        // Some people put https when they are entering their git information
        const REPO = repo.trim().replace(/^(?:https?:\/\/)?/i, '')

        const remote = `https://${USER}:${PASS}@${REPO}`

        return new Promise<string>(function(resolve, reject) {
            git()
                .silent(true)
                .raw(
                    ['clone', '--recursive', '-b', branch, remote, directory],
                    function(err: AnyError, result: string) {
                        if (err) {
                            reject(err)
                        } else {
                            resolve(result)
                        }
                    }
                )
        })
    }
}

export = GitHelper
