import DataStore from '../../datastore/DataStore'
import { IAutomatedCleanupConfigs } from '../../models/AutomatedCleanupConfigs'

export default class DiskCleanupManager {
    constructor(private dataStore: DataStore) {
        //
    }

    init() {
        return this.resetScheduledTasks()
    }

    resetScheduledTasks() {
        // TODO: Implement this method
        // clear all existing scheduled tasks
        // wait a second
        // schedule new tasks
    }

    setConfig(configs: IAutomatedCleanupConfigs) {
        const self = this

        return Promise.resolve()
            .then(() => {
                return self.dataStore.setDiskCleanupConfigs(configs)
            })
            .then(() => {
                return self.resetScheduledTasks()
            })
    }

    getConfigs() {
        const self = this

        return Promise.resolve().then(() => {
            return self.dataStore.getDiskCleanupConfigs()
        })
    }
}
