import DataStore from '../../datastore/DataStore'
import { IHashMapGeneric } from '../../models/ICacheGeneric'
import {
    IDockerComposeService,
    IOneClickTemplate,
} from '../../models/IOneClickAppModels'
import { OneClickAppValuePair } from '../../models/OneClickApp'
import Utils from '../../utils/Utils'
import ServiceManager from '../ServiceManager'
import OneClickAppDeploymentHelper from './OneClickAppDeploymentHelper'
export const ONE_CLICK_APP_NAME_VAR_NAME = '$$cap_appname'

interface IDeploymentStep {
    stepName: string
    stepPromise: () => Promise<any>
}

export interface IDeploymentState {
    steps: string[]
    error: string
    successMessage?: string
    currentStep: number
}

function replaceWith(
    replaceThis: string,
    withThis: string,
    mainString: string
) {
    return mainString.split(replaceThis).join(withThis)
}

export default class OneClickAppDeployManager {
    private deploymentHelper: OneClickAppDeploymentHelper
    private template: IOneClickTemplate | undefined
    constructor(
        dataStore: DataStore,
        serviceManager: ServiceManager,
        private onDeploymentStateChanged: (
            deploymentState: IDeploymentState
        ) => void
    ) {
        this.deploymentHelper = new OneClickAppDeploymentHelper(
            dataStore,
            serviceManager
        )
    }

    startDeployProcess(
        template: IOneClickTemplate,
        valuesArray: OneClickAppValuePair[]
    ) {
        const self = this
        let stringified = JSON.stringify(template)

        const values: IHashMapGeneric<string> = {}
        valuesArray.forEach((element) => {
            values[element.key] = element.value
        })

        if (
            template.caproverOneClickApp.variables.find(
                (v) => v.id === ONE_CLICK_APP_NAME_VAR_NAME
            ) &&
            (!values[ONE_CLICK_APP_NAME_VAR_NAME] ||
                values[ONE_CLICK_APP_NAME_VAR_NAME].trim().length === 0)
        ) {
            this.onDeploymentStateChanged({
                steps: ['Parsing the template'],
                error: `App name ($$cap_appname) is required.`,
                currentStep: 0,
            })
            return
        }

        for (
            let index = 0;
            index < template.caproverOneClickApp.variables.length;
            index++
        ) {
            const element = template.caproverOneClickApp.variables[index]
            stringified = replaceWith(
                element.id,
                values[element.id] || '',
                stringified
            )
        }

        try {
            this.template = JSON.parse(stringified)
        } catch (error) {
            this.onDeploymentStateChanged({
                steps: ['Parsing the template'],
                error: `Cannot parse: ${stringified}\n\n\n\n${error}`,
                currentStep: 0,
            })
            return
        }

        // Dependency tree and sort apps using "createAppsArrayInOrder"
        // Call "createDeploymentStepPromises" for all apps.
        // populate steps as string[]
        // create promise chain with catch -> error. Each promise gets followed by currentStep++ promise
        // Start running promises,

        const apps = this.createAppsArrayInOrder()
        if (!apps) {
            self.onDeploymentStateChanged({
                steps: ['Parsing the template'],
                error: 'Cannot parse the template. Dependency tree cannot be resolved. Infinite loop!!',
                currentStep: 0,
            })
        } else if (apps.length === 0) {
            self.onDeploymentStateChanged({
                steps: ['Parsing the template'],
                error: 'Cannot parse the template. No services found!!',
                currentStep: 0,
            })
        } else {
            const steps: IDeploymentStep[] = []
            const capAppName = values[ONE_CLICK_APP_NAME_VAR_NAME]

            const projectMemoryCache = { projectId: '' }

            if (apps.length > 1) {
                steps.push(
                    self.createDeploymentStepForProjectCreation(
                        capAppName,
                        projectMemoryCache
                    )
                )
            }

            for (let index = 0; index < apps.length; index++) {
                const appToDeploy = apps[index]
                steps.push(
                    ...self.createDeploymentStepPromises(
                        appToDeploy.appName,
                        appToDeploy.service,
                        capAppName,
                        projectMemoryCache
                    )
                )
            }

            const stepsTexts: string[] = ['Parsing the template']
            for (let index = 0; index < steps.length; index++) {
                stepsTexts.push(steps[index].stepName)
            }

            let currentStep = 0
            const onNextStepPromiseCreator = function () {
                return new Promise<void>(function (resolve) {
                    currentStep++
                    self.onDeploymentStateChanged(
                        Utils.copyObject({
                            steps: stepsTexts,
                            error: '',
                            currentStep,
                            successMessage:
                                currentStep >= stepsTexts.length
                                    ? self.template!.caproverOneClickApp
                                          .instructions.end
                                    : undefined,
                        })
                    )
                    resolve()
                })
            }

            let promise = onNextStepPromiseCreator()

            for (let index = 0; index < steps.length; index++) {
                const element = steps[index]
                promise = promise
                    .then(element.stepPromise)
                    .then(onNextStepPromiseCreator)
            }

            promise.catch(function (error) {
                self.onDeploymentStateChanged(
                    Utils.copyObject({
                        steps: stepsTexts,
                        error: `Failed: ${error}`,
                        currentStep,
                    })
                )
            })
        }
    }

    /**
     * Outputs an array which includes all services in order based on their dependencies.
     * The first element is an app without any dependencies. The second element can be an app that depends on the first app.
     */
    private createAppsArrayInOrder() {
        const apps: {
            appName: string
            service: IDockerComposeService
        }[] = []

        let numberOfServices = 0
        const servicesMap = this.template!.services
        Object.keys(servicesMap).forEach(function (key) {
            numberOfServices++
        })

        let itCount = 0
        while (apps.length < numberOfServices) {
            if (itCount > numberOfServices) {
                // we are stuck in an infinite loop
                return undefined
            }
            itCount++

            Object.keys(servicesMap).forEach(function (appName) {
                for (let index = 0; index < apps.length; index++) {
                    const element = apps[index]
                    if (element.appName === appName) {
                        // already added
                        return
                    }
                }

                const service = servicesMap[appName]

                const dependsOn = service.depends_on || []

                for (let index = 0; index < dependsOn.length; index++) {
                    const element = dependsOn[index]
                    let dependencyAlreadyAdded = false
                    for (let j = 0; j < apps.length; j++) {
                        if (element === apps[j].appName) {
                            dependencyAlreadyAdded = true
                        }
                    }

                    if (!dependencyAlreadyAdded) return
                }

                apps.push({
                    appName,
                    service,
                })
            })
        }

        return apps
    }
    private createDeploymentStepForProjectCreation(
        capAppName: string,
        projectMemoryCache: { projectId: string }
    ): IDeploymentStep {
        const self = this
        return {
            stepName: `Creating project ${capAppName}`,
            stepPromise: function () {
                return self.deploymentHelper.createRegisterPromiseProject(
                    capAppName,
                    projectMemoryCache
                )
            },
        }
    }

    private createDeploymentStepPromises(
        appName: string,
        dockerComposeService: IDockerComposeService,
        capAppName: string,
        projectMemoryCache: { projectId: string }
    ): IDeploymentStep[] {
        const promises: IDeploymentStep[] = []
        const self = this

        promises.push({
            stepName: `Registering ${appName}`,
            stepPromise: function () {
                return self.deploymentHelper.createRegisterPromise(
                    appName,
                    dockerComposeService,
                    projectMemoryCache
                )
            },
        })

        promises.push({
            stepName: `Configuring ${appName} (volumes, ports, environmental variables)`,
            stepPromise: function () {
                return self.deploymentHelper.createConfigurationPromise(
                    appName,
                    dockerComposeService,
                    capAppName
                )
            },
        })

        promises.push({
            stepName: `Deploying ${appName} (might take up to a minute)`,
            stepPromise: function () {
                return self.deploymentHelper.createDeploymentPromise(
                    appName,
                    dockerComposeService
                )
            },
        })

        return promises
    }
}
