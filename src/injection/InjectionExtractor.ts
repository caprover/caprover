import { Response } from 'express'
import { UserInjected } from '../models/InjectionInterfaces'
import { UserManager } from '../user/UserManager'

class InjectionExtractor {
    static extractUserFromInjected(res: Response) {
        return {
            user: res.locals.user as UserInjected,
        }
    }

    static extractGlobalsFromInjected(res: Response) {
        return {
            initialized: res.locals.initialized as boolean,
            namespace: res.locals.namespace as string,
            forceSsl: res.locals.forceSsl as boolean,
            userManagerForLoginOnly: res.locals
                .userManagerForLoginOnly as UserManager,
        }
    }
    static extractAppAndUserForWebhook(res: Response) {
        return {
            user: res.locals.user as UserInjected,
            appName: res.locals.appName as string,
            app: res.locals.app as IAppDef,
        }
    }

    static extractFileNameForDownload(res: Response) {
        return {
            downloadFileName: res.locals.downloadFileName as string,
        }
    }
}

export default InjectionExtractor
