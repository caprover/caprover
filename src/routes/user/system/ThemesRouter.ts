import express = require('express')
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import CapRoverTheme from '../../../models/CapRoverTheme'
import Logger from '../../../utils/Logger'

const router = express.Router()

router.post('/setcurrent/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user
    const themeName = req.body.themeName || ''

    return Promise.resolve()
        .then(function () {
            return user.dataStore.setCurrentTheme(themeName)
        })
        .then(function () {
            const msg = 'Current theme is stored.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/update/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user
    const oldName = req.body.oldName || ''
    const theme: CapRoverTheme = {
        name: req.body.name || '',
        content: req.body.content || '',
    }

    // TODO add injectToHead

    return Promise.resolve()
        .then(function () {
            return user.dataStore.saveTheme(oldName, theme)
        })
        .then(function () {
            const msg = 'Theme is stored.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user
    const themeName = req.body.themeName || ''

    return Promise.resolve()
        .then(function () {
            return user.dataStore.deleteTheme(themeName)
        })
        .then(function () {
            const msg = 'Theme is deleted.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/all/', function (req, res, next) {
    const user = InjectionExtractor.extractUserFromInjected(res).user

    return Promise.resolve()
        .then(function () {
            return user.dataStore.getThemes()
        })
        .then(function (themes) {
            const baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'Themes are retrieved.'
            )
            baseApi.data = {
                themes: themes,
            }

            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
