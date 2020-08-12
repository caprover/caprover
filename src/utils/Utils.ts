import { remove } from 'fs-extra'
import * as yaml from 'yaml'
import Logger from './Logger'

export default class Utils {
    static removeHttpHttps(input: string) {
        input = input.trim()
        input = input.replace(/^(?:http?:\/\/)?/i, '')
        input = input.replace(/^(?:https?:\/\/)?/i, '')
        return input
    }

    static isValidIp(ip: string) {
        return /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
            ip
        )
    }

    static mergeObjects(object1: any, object2: any) {
        const newObject = object1 || {}
        object2 = object2 || {}

        Object.keys(object2).forEach((k) => {
            if (
                !newObject[k] ||
                Array.isArray(newObject[k]) ||
                Array.isArray(object2[k])
            ) {
                newObject[k] = object2[k]
            } else {
                if (
                    typeof object2[k] === 'object' &&
                    typeof newObject[k] === 'object'
                ) {
                    newObject[k] = this.mergeObjects(newObject[k], object2[k])
                } else {
                    newObject[k] = object2[k]
                }
            }
        })

        return newObject
    }

    static convertYamlOrJsonToObject(raw: string | undefined) {
        raw = !!raw ? `${raw}`.trim() : ''
        if (!raw.length) {
            return undefined
        }

        let returnValue = undefined as any
        if (raw.startsWith('{') || raw.startsWith('[')) {
            try {
                returnValue = JSON.parse(raw)
            } catch (error) {
                Logger.e(error)
            }
        } else {
            try {
                returnValue = yaml.parse(raw)
            } catch (error) {
                Logger.e(error)
            }
        }

        return returnValue
    }

    static deleteFileQuietly(absFileOrDirPath: string) {
        return remove(absFileOrDirPath).catch(function (error) {
            // nom nom
        })
    }

    static isNotGetRequest(req: { method: string }) {
        return req.method !== 'GET'
    }

    static getDelayedPromise(time: number) {
        if (!time) return Promise.resolve()

        return new Promise<void>((res, rej) => {
            setTimeout(() => {
                res()
            }, time)
        })
    }

    static getNeverReturningPromise() {
        return new Promise((res, rej) => {
            //
        })
    }

    static filterInPlace<T>(arr: T[], condition: (value: T) => boolean) {
        let newArray = arr.filter(condition)
        arr.splice(0, arr.length)
        newArray.forEach((value) => arr.push(value))
    }

    static dropFirstElements(arr: any[], maxLength: number) {
        arr = arr || []
        maxLength = Number(maxLength)

        if (arr.length <= maxLength) return arr

        return arr.slice(arr.length - maxLength)
    }

    static runPromises(
        promises: (() => Promise<void>)[],
        curr?: number
    ): Promise<void> {
        let currCorrected = curr ? curr : 0
        if (promises.length > currCorrected) {
            return promises[currCorrected]().then(function () {
                return Utils.runPromises(promises, currCorrected + 1)
            })
        }

        return Promise.resolve()
    }
}
