import DataStore from '../datastore/DataStore'
import ServiceManager from '../user/ServiceManager'

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
