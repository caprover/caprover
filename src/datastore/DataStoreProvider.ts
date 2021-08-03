/**
 * Created by kasra on 27/06/17.
 */

import ApiStatusCodes from '../api/ApiStatusCodes'
import CaptainConstants from '../utils/CaptainConstants'
import DataStore from './DataStore'

const dataStoreCache: IHashMapGeneric<DataStore> = {}

export default {
    getDataStore: function (namespace: string) {
        if (!namespace) {
            throw new Error('NameSpace is empty')
        }

        if (namespace !== CaptainConstants.rootNameSpace) {
            throw ApiStatusCodes.createError(
                ApiStatusCodes.STATUS_ERROR_GENERIC,
                'Namespace unknown'
            )
        }

        if (!dataStoreCache[namespace]) {
            dataStoreCache[namespace] = new DataStore(namespace)
        }

        return dataStoreCache[namespace]
    },
}
