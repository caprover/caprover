import express = require('express')
import BaseApi from '../../api/BaseApi'
import ApiStatusCodes from '../../api/ApiStatusCodes'
import CaptainConstants from '../../utils/CaptainConstants'
import InjectionExtractor from '../../injection/InjectionExtractor'
import DataStoreProvider from '../../datastore/DataStoreProvider'
import CaptainManager from '../../user/system/CaptainManager'
import Authenticator from '../../user/Authenticator'
import Utils from '../../utils/Utils'

const router = express.Router()

router.get('/', function (req, res, next) {
    let downloadToken = req.query.downloadToken as string
    let namespace = req.query.namespace as string

    Promise.resolve() //
        .then(function () {
            return Authenticator.getAuthenticator(
                namespace
            ).decodeDownloadToken(downloadToken)
        })
        .then(function (obj) {
            const fileFullPath =
                CaptainConstants.captainDownloadsDirectory +
                '/' +
                namespace +
                '/' +
                obj.downloadFileName
            res.download(fileFullPath, function () {
                Utils.deleteFileQuietly(fileFullPath)
            })
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
