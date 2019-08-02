import WebhooksRouter = require('./webhooks/WebhooksRouter')
import AppDefinitionRouter = require('./appdefinition/AppDefinitionRouter')
import AppDataRouter = require('./appdata/AppDataRouter')

import express = require('express')

const router = express.Router()

router.use('/appDefinitions/', AppDefinitionRouter)

router.use('/appData/', AppDataRouter)

// semi-secured end points:
router.use('/webhooks/', WebhooksRouter)

export = router
