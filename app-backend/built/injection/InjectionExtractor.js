"use strict";
class InjectionExtractor {
    static extractUserFromInjected(res) {
        return {
            user: res.locals.user,
        };
    }
    static extractGlobalsFromInjected(res) {
        return {
            initialized: res.locals.initialized,
            namespace: res.locals.namespace,
            forceSsl: res.locals.forceSsl,
        };
    }
    static extractAppAndUserForWebhook(res) {
        return {
            user: res.locals.user,
            appName: res.locals.namespace,
            app: res.locals.app,
        };
    }
}
module.exports = InjectionExtractor;
//# sourceMappingURL=InjectionExtractor.js.map