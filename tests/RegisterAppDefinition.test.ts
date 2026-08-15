import ApiStatusCodes from '../src/api/ApiStatusCodes'
import { registerAppDefinition } from '../src/handlers/users/apps/appdefinition/AppDefinitionHandler'

describe('registerAppDefinition', () => {
    const getProject = jest.fn()
    const saveApp = jest.fn()
    const deleteApp = jest.fn()
    const scheduleDeploy = jest.fn()

    const dataStore = {
        getProjectsDataStore: () => ({ getProject }),
        getAppsDataStore: () => ({
            registerAppDefinition: saveApp,
            deleteAppDefinition: deleteApp,
        }),
    } as any

    const serviceManager = {
        scheduleDeployNewVersion: scheduleDeploy,
    } as any

    beforeEach(() => {
        jest.clearAllMocks()
        getProject.mockResolvedValue({ id: 'project-id' })
        saveApp.mockResolvedValue(undefined)
        deleteApp.mockResolvedValue(undefined)
        scheduleDeploy.mockResolvedValue(undefined)
    })

    it('validates and saves an existing project ID', async () => {
        await registerAppDefinition(
            {
                appName: 'test-app',
                projectId: 'project-id',
                hasPersistentData: false,
                isDetachedBuild: false,
            },
            dataStore,
            serviceManager
        )

        expect(getProject).toHaveBeenCalledWith('project-id')
        expect(saveApp).toHaveBeenCalledWith('test-app', 'project-id', false)
        expect(scheduleDeploy).toHaveBeenCalledTimes(1)
    })

    it('uses the same trimmed project ID for validation and persistence', async () => {
        await registerAppDefinition(
            {
                appName: 'trimmed-app',
                projectId: '  project-id  ',
                hasPersistentData: true,
                isDetachedBuild: false,
            },
            dataStore,
            serviceManager
        )

        expect(getProject).toHaveBeenCalledWith('project-id')
        expect(saveApp).toHaveBeenCalledWith('trimmed-app', 'project-id', true)
    })

    it.each(['', '   '])('treats %p as the root project', async (projectId) => {
        await registerAppDefinition(
            {
                appName: 'root-app',
                projectId,
                hasPersistentData: false,
                isDetachedBuild: false,
            },
            dataStore,
            serviceManager
        )

        expect(getProject).not.toHaveBeenCalled()
        expect(saveApp).toHaveBeenCalledWith('root-app', '', false)
    })

    it('does not write or deploy when the project does not exist', async () => {
        getProject.mockRejectedValue(
            ApiStatusCodes.createError(
                ApiStatusCodes.ILLEGAL_OPERATION,
                'Project not found'
            )
        )

        await expect(
            registerAppDefinition(
                {
                    appName: 'orphan-app',
                    projectId: 'deleted-project',
                    hasPersistentData: false,
                    isDetachedBuild: false,
                },
                dataStore,
                serviceManager
            )
        ).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.ILLEGAL_OPERATION,
            apiMessage: 'Project not found',
        })

        expect(saveApp).not.toHaveBeenCalled()
        expect(scheduleDeploy).not.toHaveBeenCalled()
        expect(deleteApp).not.toHaveBeenCalled()
    })
})
