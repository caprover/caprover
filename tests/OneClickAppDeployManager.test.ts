import OneClickAppDeployManager, {
    ONE_CLICK_APP_NAME_VAR_NAME,
} from '../src/user/oneclick/OneClickAppDeployManager'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'

describe('OneClickAppDeployManager', () => {
    test('treats omitted values as an empty array', () => {
        const onDeploymentStateChanged = jest.fn()
        const manager = new OneClickAppDeployManager(
            {} as any,
            {} as any,
            onDeploymentStateChanged
        )

        const template: IOneClickTemplate = {
            captainVersion: 4,
            services: {},
            caproverOneClickApp: {
                displayName: 'Test App',
                instructions: {
                    start: '',
                    end: '',
                },
                variables: [
                    {
                        id: ONE_CLICK_APP_NAME_VAR_NAME,
                        label: 'App Name',
                    },
                ],
            },
        }

        expect(() => manager.startDeployProcess(template)).not.toThrow()
        expect(onDeploymentStateChanged).toHaveBeenCalledWith({
            steps: ['Parsing the template'],
            error: 'App name ($$cap_appname) is required.',
            currentStep: 0,
        })
    })
})
