import ApiStatusCodes from '../src/api/ApiStatusCodes'
import { IOneClickTemplate } from '../src/models/IOneClickAppModels'
import OneClickAppDeployManager, {
    ONE_CLICK_APP_NAME_VAR_NAME,
    OneClickDeploymentOptions,
    validateOneClickDeploymentOptions,
} from '../src/user/oneclick/OneClickAppDeployManager'
import OneClickAppDeploymentHelper from '../src/user/oneclick/OneClickAppDeploymentHelper'

function createTemplate(
    serviceNames: string[],
    includeAppNameVariable: boolean
): IOneClickTemplate {
    const services = serviceNames.reduce((result, serviceName) => {
        result[serviceName] = { image: `${serviceName}:1` }
        return result
    }, {} as any)

    return {
        captainVersion: 4,
        services,
        caproverOneClickApp: {
            displayName: 'Test template',
            instructions: {
                start: 'Starting',
                end: 'Finished',
            },
            variables: includeAppNameVariable
                ? [
                      {
                          id: ONE_CLICK_APP_NAME_VAR_NAME,
                          label: 'App Name',
                      },
                  ]
                : [],
        },
    }
}

async function deployAndWait(
    template: IOneClickTemplate,
    options: OneClickDeploymentOptions,
    deploymentHelper: any,
    appName: string = 'bundle'
) {
    let resolveFinished: () => void = () => undefined
    const finished = new Promise<void>((resolve) => {
        resolveFinished = resolve
    })
    const stateChanges: any[] = []
    const manager = new OneClickAppDeployManager(
        {} as any,
        {} as any,
        (state) => {
            stateChanges.push(state)
            if (state.error || state.currentStep >= state.steps.length) {
                resolveFinished()
            }
        }
    )
    ;(manager as any).deploymentHelper = deploymentHelper

    const values = template.caproverOneClickApp.variables.length
        ? [{ key: ONE_CLICK_APP_NAME_VAR_NAME, value: appName }]
        : []
    manager.startDeployProcess(template, values, options)
    await finished

    return stateChanges
}

describe('OneClickAppDeployManager project assignment', () => {
    let registrations: Array<{ appName: string; projectId: string }>
    let deploymentHelper: any

    beforeEach(() => {
        registrations = []
        deploymentHelper = {
            createRegisterPromiseProject: jest.fn(
                (
                    projectName: string,
                    projectMemoryCache: { projectId: string }
                ) => {
                    projectMemoryCache.projectId = 'generated-group-id'
                    return Promise.resolve()
                }
            ),
            createRegisterPromise: jest.fn(
                (
                    appName: string,
                    service: any,
                    projectMemoryCache: { projectId: string }
                ) => {
                    registrations.push({
                        appName,
                        projectId: projectMemoryCache.projectId,
                    })
                    return Promise.resolve()
                }
            ),
            createConfigurationPromise: jest.fn().mockResolvedValue(undefined),
            createDeploymentPromise: jest.fn().mockResolvedValue(undefined),
        }
    })

    it('assigns a single service directly to the selected project', async () => {
        await deployAndWait(
            createTemplate(['web'], true),
            { parentProjectId: 'parent-id' },
            deploymentHelper,
            'web-app'
        )

        expect(
            deploymentHelper.createRegisterPromiseProject
        ).not.toHaveBeenCalled()
        expect(registrations).toEqual([
            { appName: 'web', projectId: 'parent-id' },
        ])
    })

    it('keeps a root single-service deployment at root', async () => {
        await deployAndWait(
            createTemplate(['web'], true),
            {},
            deploymentHelper,
            'web-app'
        )

        expect(registrations).toEqual([{ appName: 'web', projectId: '' }])
    })

    it('creates a nested group and assigns every service to it', async () => {
        await deployAndWait(
            createTemplate(['database', 'web'], false),
            {
                parentProjectId: 'parent-id',
                projectName: 'compose-stack',
                templateName: 'DOCKER_COMPOSE',
            },
            deploymentHelper
        )

        expect(
            deploymentHelper.createRegisterPromiseProject
        ).toHaveBeenCalledWith(
            'compose-stack',
            expect.objectContaining({ projectId: 'generated-group-id' }),
            'parent-id'
        )
        expect(registrations).toEqual([
            { appName: 'database', projectId: 'generated-group-id' },
            { appName: 'web', projectId: 'generated-group-id' },
        ])
    })

    it('uses the one-click app name for a root group', async () => {
        await deployAndWait(
            createTemplate(['database', 'web'], true),
            {},
            deploymentHelper,
            'one-click-stack'
        )

        expect(
            deploymentHelper.createRegisterPromiseProject
        ).toHaveBeenCalledWith('one-click-stack', expect.any(Object), '')
        expect(
            registrations.every(
                (item) => item.projectId === 'generated-group-id'
            )
        ).toBe(true)
    })

    it('keeps $$cap_appname as the group name for one-click templates', async () => {
        await deployAndWait(
            createTemplate(['database', 'web'], true),
            {
                projectName: 'should-be-ignored',
                templateName: 'OFFICIAL_TEST',
            },
            deploymentHelper,
            'one-click-stack'
        )

        expect(
            deploymentHelper.createRegisterPromiseProject
        ).toHaveBeenCalledWith('one-click-stack', expect.any(Object), '')
    })
})

describe('validateOneClickDeploymentOptions', () => {
    const getProject = jest.fn()
    const dataStore = {
        getProjectsDataStore: () => ({ getProject }),
    } as any
    const multiServiceTemplate = createTemplate(['database', 'web'], false)

    beforeEach(() => {
        jest.clearAllMocks()
        getProject.mockResolvedValue({ id: 'parent-id' })
    })

    it('validates a trimmed parent project before deployment', async () => {
        await validateOneClickDeploymentOptions(
            dataStore,
            multiServiceTemplate,
            {
                parentProjectId: '  parent-id  ',
                projectName: 'compose-stack',
                templateName: 'DOCKER_COMPOSE',
            }
        )

        expect(getProject).toHaveBeenCalledWith('parent-id')
    })

    it('preserves the Project not found error for a deleted parent', async () => {
        getProject.mockRejectedValue(
            ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_OPERATION,
                'Project not found'
            )
        )

        await expect(
            validateOneClickDeploymentOptions(dataStore, multiServiceTemplate, {
                parentProjectId: 'deleted-parent',
                projectName: 'compose-stack',
                templateName: 'DOCKER_COMPOSE',
            })
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
            apiMessage: 'Project not found',
        })
    })

    it.each(['', 'Invalid Name', 'double--hyphen', 'root'])(
        'rejects invalid Compose group name %p before deployment',
        async (projectName) => {
            await expect(
                validateOneClickDeploymentOptions(
                    dataStore,
                    multiServiceTemplate,
                    {
                        projectName,
                        templateName: 'DOCKER_COMPOSE',
                    }
                )
            ).rejects.toMatchObject({
                captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
            })

            expect(getProject).not.toHaveBeenCalled()
        }
    )

    it('rejects an invalid one-click group name before deployment', async () => {
        await expect(
            validateOneClickDeploymentOptions(
                dataStore,
                createTemplate(['database', 'web'], true),
                {},
                [
                    {
                        key: ONE_CLICK_APP_NAME_VAR_NAME,
                        value: 'Invalid Name',
                    },
                ]
            )
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
        })

        expect(getProject).not.toHaveBeenCalled()
    })
})

describe('OneClickAppDeploymentHelper project creation', () => {
    it('passes the selected parent to the generated group project', async () => {
        const helper = new OneClickAppDeploymentHelper({} as any, {} as any)
        const registerProject = jest.fn().mockResolvedValue({
            data: { id: 'generated-group-id' },
        })
        ;(helper as any).apiManager = { registerProject }
        const projectMemoryCache = { projectId: 'parent-id' }

        await helper.createRegisterPromiseProject(
            'compose-stack',
            projectMemoryCache,
            'parent-id'
        )

        expect(registerProject).toHaveBeenCalledWith({
            id: '',
            name: 'compose-stack',
            description: '',
            parentProjectId: 'parent-id',
        })
        expect(projectMemoryCache.projectId).toBe('generated-group-id')
    })
})
