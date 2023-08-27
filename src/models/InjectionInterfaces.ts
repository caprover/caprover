import DataStore from '../datastore/DataStore'
import OtpAuthenticator from '../user/pro/OtpAuthenticator'
import ServiceManager from '../user/ServiceManager'
import { UserManager } from '../user/UserManager'

export interface UserInjected {
    namespace: string
    userManager: UserManager

    // @deprecated - use UserManager
    dataStore: DataStore

    // @deprecated - use UserManager
    otpAuthenticator: OtpAuthenticator

    // @deprecated - use UserManager
    serviceManager: ServiceManager

    // @deprecated - use UserManager
    initialized: boolean
}

export interface IAppWebHookToken {
    appName: string
    tokenVersion: string
}
