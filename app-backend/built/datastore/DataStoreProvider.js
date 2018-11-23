"use strict";
/**
 * Created by kasra on 27/06/17.
 */
const DataStore = require("./DataStoreImpl");
const dataStoreCache = {};
module.exports = {
    getDataStore: function (namespace) {
        if (!namespace) {
            throw new Error('NameSpace is empty');
        }
        if (!dataStoreCache[namespace]) {
            dataStoreCache[namespace] = new DataStore(namespace);
        }
        return dataStoreCache[namespace];
    },
};
//# sourceMappingURL=DataStoreProvider.js.map