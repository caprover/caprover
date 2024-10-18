import axios from 'axios'
import DataStore from '../datastore/DataStore'
import CaptainConstants from '../utils/CaptainConstants'
import Logger from '../utils/Logger'

export default class FeatureFlags {
    static instance: FeatureFlags

    private featureFlags: any | undefined
    static IS_PRO_ENABLED = 'isProEnabled'

    static get(datastore: DataStore) {
        if (!FeatureFlags.instance) {
            FeatureFlags.instance = new FeatureFlags(datastore)
        }
        return FeatureFlags.instance
    }

    private constructor(private datastore: DataStore) {
        this.refreshFeatureFlags()
        const self = this
        self.featureFlags = self.datastore.getFeatureFlags()
    }

    getFeatureFlags(): any | undefined {
        return this.featureFlags
    }

    private refreshFeatureFlags() {
        const self = this
        Promise.resolve() //
            .then(function () {
                return axios.get(
                    'https://api-v1.caprover.com/v2/featureflags',
                    {
                        params: {
                            currentVersion: CaptainConstants.configs.version,
                        },
                    }
                )
            })
            .then(function (responseObj) {
                const resp = responseObj.data

                if (resp.status !== 100) {
                    throw new Error(
                        `Bad response from the upstream version info: ${resp.status}`
                    )
                }

                const data = resp.data

                self.featureFlags = data.featureFlags
                return self.datastore.setFeatureFlags(self.featureFlags)
            })
            .catch(function (error) {
                Logger.e(error)
            })
            .then(function () {
                setTimeout(
                    () => {
                        self.refreshFeatureFlags()
                    },
                    1000 * 3600 * 19.3
                ) // some random hour to avoid constant traffic
            })
    }
}
