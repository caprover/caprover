import WebhooksRouter = require('./WebhooksRouter')
import AppDefinitionRouter = require('./AppDefinitionRouter')
import AppDataRouter = require('./AppDataRouter')

import express = require('express')

const router = express.Router()

router.use('/appDefinitions/', AppDefinitionRouter)

router.use('/appData/', AppDataRouter)

// semi-secured end points:
router.use('/webhooks/', WebhooksRouter)

export = router
