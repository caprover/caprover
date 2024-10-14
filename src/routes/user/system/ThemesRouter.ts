import express = require('express')
import ApiStatusCodes from '../../../api/ApiStatusCodes'
import BaseApi from '../../../api/BaseApi'
import InjectionExtractor from '../../../injection/InjectionExtractor'
import CapRoverTheme from '../../../models/CapRoverTheme'
import { ThemeManager } from '../../../user/ThemeManager'
import Logger from '../../../utils/Logger'

const router = express.Router()

router.post('/setcurrent/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    const themeName = req.body.themeName || ''

    return Promise.resolve()
        .then(function () {
            new ThemeManager(dataStore).setCurrent(themeName)
        })
        .then(function () {
            const msg = 'Current theme is stored.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/update/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const oldName = req.body.oldName || ''
    const theme: CapRoverTheme = {
        name: req.body.name || '',
        content: req.body.content || '',
    }

    return Promise.resolve()
        .then(function () {
            return new ThemeManager(dataStore).updateTheme(oldName, theme)
        })
        .then(function () {
            const msg = 'Theme is stored.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.post('/delete/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore
    const themeName = req.body.themeName || ''

    return Promise.resolve()
        .then(function () {
            return new ThemeManager(dataStore).deleteTheme(themeName)
        })
        .then(function () {
            const msg = 'Theme is deleted.'
            Logger.d(msg)
            res.send(new BaseApi(ApiStatusCodes.STATUS_OK, msg))
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/all/', function (req, res, next) {
    const dataStore =
        InjectionExtractor.extractUserFromInjected(res).user.dataStore

    return Promise.resolve()
        .then(function () {
            return new ThemeManager(dataStore).getAllThemes()
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
