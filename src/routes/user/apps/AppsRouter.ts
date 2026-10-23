import AppDataRouter from './appdata/AppDataRouter'
import AppDefinitionRouter from './appdefinition/AppDefinitionRouter'
import WebhooksRouter from './webhooks/WebhooksRouter'
import RuntimeRouter from './RuntimeRouter'

import express = require('express')

const router = express.Router()

router.use('/appDefinitions/', AppDefinitionRouter)

router.use('/appData/', AppDataRouter)

router.use('/runtime/', RuntimeRouter)

// semi-secured end points:
router.use('/webhooks/', WebhooksRouter)

export default router
