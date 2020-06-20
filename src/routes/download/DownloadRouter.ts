import express = require('express')
import BaseApi = require('../../api/BaseApi')
import ApiStatusCodes = require('../../api/ApiStatusCodes')
import CaptainConstants = require('../../utils/CaptainConstants')
import InjectionExtractor = require('../../injection/InjectionExtractor')
import DataStoreProvider = require('../../datastore/DataStoreProvider')
import CaptainManager = require('../../user/system/CaptainManager')
import Authenticator = require('../../user/Authenticator')
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

export = router
