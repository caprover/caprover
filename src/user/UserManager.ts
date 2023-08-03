import DataStore from '../datastore/DataStore'
import DataStoreProvider from '../datastore/DataStoreProvider'
import DockerApi from '../docker/DockerApi'
import Authenticator from './Authenticator'
import { EventLogger, EventLoggerFactory } from './events/EventLogger'
import FeatureFlags from './FeatureFlags'
import OtpAuthenticator from './pro/OtpAuthenticator'
import ProManager from './pro/ProManager'
import ServiceManager from './ServiceManager'
import CaptainManager from './system/CaptainManager'

export class UserManager {
    readonly datastore: DataStore
    readonly proManager: ProManager
    readonly serviceManager: ServiceManager
    readonly otpAuthenticator: OtpAuthenticator
    eventLogger: EventLogger
    constructor(namespace: string) {
        this.datastore = DataStoreProvider.getDataStore(namespace)
        this.proManager = new ProManager(
            this.datastore.getProDataStore(),
            new FeatureFlags(this.datastore)
        )
        this.eventLogger = EventLoggerFactory.get(this.proManager).getLogger()
        this.serviceManager = ServiceManager.get(
            namespace,
            Authenticator.getAuthenticator(namespace),
            this.datastore,
            DockerApi.get(),
            CaptainManager.get().getLoadBalanceManager(),
            this.eventLogger,
            CaptainManager.get().getDomainResolveChecker()
        )
        this.otpAuthenticator = new OtpAuthenticator(
            this.datastore,
            this.proManager
        )
    }
}
