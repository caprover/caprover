import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import DataStoreProvider from '../../datastore/DataStoreProvider'
import CaptainConstants from '../../utils/CaptainConstants'

const router = express.Router()

router.get('/current', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return DataStoreProvider.getDataStore(
                CaptainConstants.rootNameSpace
            ).getCurrentTheme()
        })
        .then(function (t) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Current theme is retrieved.'
            )
            baseApi.data = {
                theme: t,
            }

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
