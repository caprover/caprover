import express = require('express')
import fs = require('fs')
import BaseApi = require('../../../../api/BaseApi')
import ApiStatusCodes = require('../../../../api/ApiStatusCodes')
import Logger = require('../../../../utils/Logger')
import CaptainConstants = require('../../../../utils/CaptainConstants')
import { CaptainError } from '../../../../models/OtherTypes'
import InjectionExtractor = require('../../../../injection/InjectionExtractor')
import Utils from '../../../../utils/Utils'
import axios from 'axios'

const router = express.Router()
interface IOneClickAppIdentifier {
    baseUrl: string
    name: string
    displayName: string
    description: string
    logoUrl: string
}

router.get('/list', function(req, res, next) {
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore

    return Promise.resolve() //
        .then(function() {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function(urls) {
            const promises = [] as Promise<IOneClickAppIdentifier[]>[]

            urls.forEach(apiBaseUrl => {
                const p = axios
                    .get(apiBaseUrl + `/v2/list`) //
                    .then(function(axiosResponse) {
                        return axiosResponse.data.oneClickApps as any[]
                    })
                    .then(function(apps: any[]) {
                        return apps.map(element => {
                            const ret: IOneClickAppIdentifier = {
                                baseUrl: apiBaseUrl,
                                name: element.name,
                                displayName: `${element.displayName}`,
                                description: `${element.description}`,
                                logoUrl: `${element.logoUrl}`,
                            }
                            return ret
                        })
                    })
                    .catch(err => {
                        Logger.e(err)
                        return [] as IOneClickAppIdentifier[]
                    })

                promises.push(p)
            })

            return Promise.all(promises)
        })
        .then(function(arrayOfArrays) {
            const allApps = [] as IOneClickAppIdentifier[]
            arrayOfArrays.map(appsFromBase => {
                return allApps.push(...appsFromBase)
            })
            return allApps
        })
        .then(function(allApps) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'All one click apps are retrieved'
            )
            baseApi.data = {}
            baseApi.data.oneClickApps = allApps
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

router.get('/app', function(req, res, next) {
    const baseDomain = req.query.baseDomain as string
    const appName = req.query.appName as string
    const dataStore = InjectionExtractor.extractUserFromInjected(res).user
        .dataStore

    return Promise.resolve() //
        .then(function() {
            return dataStore.getAllOneClickBaseUrls()
        })
        .then(function(urls) {
            if (urls.indexOf(baseDomain) < 0)
                throw ApiStatusCodes.createError(
                    ApiStatusCodes.ILLEGAL_PARAMETER,
                    'Unknown base URL '
                )

            const appUrl = `${baseDomain}/v2/apps/${appName}.json`
            Logger.d('retrieving app at: ' + appUrl)

            return axios.get(appUrl).then(function(responseObject) {
                return responseObject.data
            })
        })
        .then(function(appTemplate) {
            let baseApi = new BaseApi(
                ApiStatusCodes.STATUS_OK,
                'App template is retrieved'
            )
            baseApi.data = {}
            baseApi.data.appTemplate = appTemplate
            res.send(baseApi)
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export = router
