import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import BaseApi from '../../api/BaseApi'
import { ThemeManagerPublic } from '../../user/ThemeManager'

const router = express.Router()

router.get('/current', function (req, res, next) {
    return Promise.resolve()
        .then(function () {
            return new ThemeManagerPublic().getCurrentTheme()
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
