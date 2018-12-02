"use strict";
const WebhooksRouter = require("./WebhooksRouter");
const AppDefinitionRouter = require("./AppDefinitionRouter");
const AppDataRouter = require("./AppDataRouter");
const express = require("express");
const router = express.Router();
router.use('/appDefinitions/', AppDefinitionRouter);
router.use('/appData/', AppDataRouter);
// semi-secured end points:
router.use('/webhooks/', WebhooksRouter);
module.exports = router;
//# sourceMappingURL=AppsRouter.js.map