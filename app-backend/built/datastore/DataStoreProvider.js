/**
 * Created by kasra on 27/06/17.
 */
var DataStore = require('./DataStoreImpl');
var dataStoreCache = {};
module.exports = {
    getDataStore: function (namespace) {
        if (!namespace) {
            return null;
        }
        if (!dataStoreCache[namespace]) {
            dataStoreCache[namespace] = new DataStore(namespace);
        }
        return dataStoreCache[namespace];
    }
};
