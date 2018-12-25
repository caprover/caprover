/**
 * Created by kasra on 27/06/17.
 */

const DataStore = require('./DataStoreImpl');
const CaptainConstants = require('../utils/CaptainConstants');
const dataStoreCache = {};

module.exports = {

    getDataStore: function (namespace) {

        if (!namespace) {
            return null;
        }

        if (namespace === CaptainConstants.rootNameSpace) {

            if (!dataStoreCache[namespace]) {
                dataStoreCache[namespace] = new DataStore(namespace);
            }

            return dataStoreCache[namespace];
        }

        return null;
    }

};