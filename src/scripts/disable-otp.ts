import DataStoreProvider from '../datastore/DataStoreProvider'

DataStoreProvider.getDataStore('captain')
    .getProDataStore()
    .setOtpEnabled(false)
    .catch((err) => console.log(err))
