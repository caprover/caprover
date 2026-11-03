import { AnyError } from '../models/OtherTypes'
import CaptainConstants from './CaptainConstants'
import { formatLogDate } from './DateUtils'

function errorize(error: AnyError) {
    if (!(error instanceof Error)) {
        return new Error(`Wrapped: ${error ? error : 'NULL'}`)
    }

    return error
}

function getTime() {
    return `[36m${formatLogDate(new Date())}[0m`
}

class Logger {
    static d(msg: string) {
        console.log(getTime() + msg + '')
    }

    static w(msg: string) {
        console.log(getTime() + msg + '')
    }

    static dev(msg: string) {
        if (CaptainConstants.isDebug) {
            console.log(`${getTime()}########### ${msg}`)
        }
    }

    static e(msgOrError: AnyError, message?: string) {
        const err = errorize(msgOrError)
        console.error(`${getTime() + ((message || '') + '\n') + err}
${err.stack}`)
    }
}
export default Logger
