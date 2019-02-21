export default class Utils {
    static removeHttpHttps(input: string) {
        input = input.trim()
        input = input.replace(/^(?:http?:\/\/)?/i, '')
        input = input.replace(/^(?:https?:\/\/)?/i, '')
        return input
    }
    static isNotGetRequest(req: { method: string }) {
        return req.method !== 'GET'
    }

    static getDelayedPromise(time: number) {
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

    static runPromises(
        promises: (() => Promise<void>)[],
        curr?: number
    ): Promise<void> {
        let currCorrected = curr ? curr : 0
        if (promises.length > currCorrected) {
            return promises[currCorrected]().then(function() {
                return Utils.runPromises(promises, currCorrected + 1)
            })
        }

        return Promise.resolve()
    }
}
