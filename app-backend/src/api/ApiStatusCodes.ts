import { CaptainError } from './CaptainError'
import { Response } from 'express'
import BaseApi = require('./BaseApi')
import Logger = require('../utils/Logger')

class ApiStatusCodes {
    static createError(code: number, message: string) {
        return new CaptainError(code, message || 'NONE')
    }

    static createCatcher(res: Response) {
        return function(error: CaptainError | any) {
            Logger.e(error)

            if (error && error.captainErrorType) {
                res.send(new BaseApi(error.captainErrorType, error.apiMessage))
                return
            }

            res.sendStatus(500)
        }
    }

    static STATUS_OK_DEPLOY_STARTED: 101
    static STATUS_ERROR_GENERIC: 1000
    static STATUS_OK: 100
    static STATUS_ERROR_CAPTAIN_NOT_INITIALIZED: 1001
    static STATUS_ERROR_USER_NOT_INITIALIZED: 1101
    static STATUS_ERROR_NOT_AUTHORIZED: 1102
    static STATUS_ERROR_ALREADY_EXIST: 1103
    static STATUS_ERROR_BAD_NAME: 1104
    static STATUS_WRONG_PASSWORD: 1105
    static STATUS_AUTH_TOKEN_INVALID: 1106
    static VERIFICATION_FAILED: 1107
    static ILLEGAL_OPERATION: 1108
    static BUILD_ERROR: 1109
    static ILLEGAL_PARAMETER: 1110
    static NOT_FOUND: 1111
}

export = ApiStatusCodes
