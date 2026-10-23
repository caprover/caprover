import express = require('express')
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'

const router = express.Router()

router.get('/', function (req, res) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return serviceManager
        .getAppsRuntime()
        .then(function (data) {
            const response = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App runtime information retrieved.'
            )
            response.data = data
            res.send(response)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/:appName', function (req, res) {
    const serviceManager =
        InjectionExtractor.extractUserFromInjected(res).user.serviceManager

    return serviceManager
        .getAppRuntime(req.params.appName)
        .then(function (data) {
            const response = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App runtime information retrieved.'
            )
            response.data = data
            res.send(response)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
