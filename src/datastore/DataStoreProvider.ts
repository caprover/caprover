/**
 * Created by kasra on 27/06/17.
 */

import DataStore = require('./DataStore')

const dataStoreCache: IHashMapGeneric<DataStore> = {}

export = {
    getDataStore: function (namespace: string) {
        if (!namespace) {
            throw new Error('NameSpace is empty')
        }

        if (!dataStoreCache[namespace]) {
            dataStoreCache[namespace] = new DataStore(namespace)
        }

        return dataStoreCache[namespace]
    },
}
