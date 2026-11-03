import configstore = require('configstore')
import AppsDataStore from '../src/datastore/AppsDataStore'
import ProjectsDataStore from '../src/datastore/ProjectsDataStore'

const PROJECT_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'

function projectsDataStore() {
    const data = { get: jest.fn(), set: jest.fn() }
    const store = new ProjectsDataStore(
        data as unknown as configstore,
        {} as AppsDataStore
    )
    const save = (name: string) =>
        store.saveProject(PROJECT_ID, { id: PROJECT_ID, name, description: '' })
    return { data, save }
}

describe('ProjectsDataStore project names', () => {
    test('accepts a name that starts with a number, as app names do', async () => {
        // A one-click app with more than one service creates a project named
        // after the app, so a leading number, which app names accept since
        // be5d55d, has to be accepted here too.
        const { data, save } = projectsDataStore()
        await save('1app')
        expect(data.set).toHaveBeenCalledWith(
            `projectsDefinitions.${PROJECT_ID}`,
            expect.objectContaining({ name: '1app' })
        )
    })

    test.each(['-app', 'App', 'my--app', 'a'.repeat(50), 'root', 'captain'])(
        'still refuses %s',
        async (name) => {
            const { data, save } = projectsDataStore()
            await expect(save(name)).rejects.toThrow(
                'Project name is not allowed'
            )
            expect(data.set).not.toHaveBeenCalled()
        }
    )
})
