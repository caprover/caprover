import DataStore = require('../datastore/DataStore')
import ServiceManager = require('../user/ServiceManager')

export interface UserJwt {
    namespace: string
    tokenVersion: string
}

export interface UserInjected {
    namespace: string
    dataStore: DataStore
    serviceManager: ServiceManager
    initialized: boolean
}

export interface IAppWebHookToken {
    appName: string
    tokenVersion: string
}
