import DataStore = require('../datastore/DataStore')
import ServiceManager = require('../user/ServiceManager')

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
