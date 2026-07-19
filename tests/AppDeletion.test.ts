import { ensureAppsExist } from '../src/routes/user/apps/appdefinition/AppDefinitionRouter'

describe('app deletion', () => {
    test('rejects the entire request when any requested app is missing', () => {
        expect(() =>
            ensureAppsExist(['existing-app', 'missing-app'], {
                'existing-app': {},
            })
        ).toThrow(
            'App (missing-app) could not be found. Make sure that you have created the app.'
        )
    })
})
