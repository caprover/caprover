import express = require('express')
import ApiStatusCodes from '../../api/ApiStatusCodes'
import Authenticator from '../../user/Authenticator'
import CaptainConstants from '../../utils/CaptainConstants'
import Utils from '../../utils/Utils'

const router = express.Router()

router.get('/', function (req, res, next) {
    const downloadToken = req.query.downloadToken as string
    const namespace = req.query.namespace as string

    Promise.resolve() //
        .then(function () {
            return Authenticator.getAuthenticator(
                namespace
            ).decodeDownloadToken(downloadToken)
        })
        .then(function (obj) {
            const fileFullPath = `${CaptainConstants.captainDownloadsDirectory}/${namespace}/${obj.downloadFileName}`
            res.download(fileFullPath, function (error) {
                Utils.deleteFileQuietly(fileFullPath)

                if (!error) return

                if (
                    !res.headersSent &&
                    (error.status === 404 || error.code === 'ENOENT')
                ) {
                    res.sendStatus(404)
                    return
                }

                next(error)
            })
        })
        .catch(ApiStatusCodes.createCatcher(res))
})

export default router
