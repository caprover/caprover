import * as configstore from 'configstore'
import AppsDataStore from '../src/datastore/AppsDataStore'
import ProjectsDataStore from '../src/datastore/ProjectsDataStore'

describe('ProjectsDataStore', () => {
    let projectsDataStore: ProjectsDataStore

    beforeEach(() => {
        // Mock the configstore and AppsDataStore
        const mockConfigstore = new configstore('test')
        const mockAppsDataStore = {} as AppsDataStore
        projectsDataStore = new ProjectsDataStore(
            mockConfigstore,
            mockAppsDataStore
        )
    })

    describe('organizeFromTheLeafsToRoot', () => {
        it('should correctly organize projects from leaves to root', () => {
            const input = [
                {
                    id: '1',
                    name: 'Root 1',
                    parentProjectId: '',
                    description: 'Root 1 desc',
                },
                {
                    id: '2',
                    name: 'Child 1',
                    parentProjectId: '1',
                    description: 'Child 1 desc',
                },
                {
                    id: '3',
                    name: 'Child 2',
                    parentProjectId: '1',
                    description: 'Child 2 desc',
                },
                {
                    id: '4',
                    name: 'Grandchild 1',
                    parentProjectId: '2',
                    description: 'Grandchild 1 desc',
                },
                {
                    id: '5',
                    name: 'Root 2',
                    parentProjectId: '',
                    description: 'Root 2 desc',
                },
                {
                    id: '6',
                    name: 'Child 3',
                    parentProjectId: '5',
                    description: 'Child 3 desc',
                },
            ]

            const expected = [
                {
                    id: '4',
                    name: 'Grandchild 1',
                    parentProjectId: '2',
                    description: 'Grandchild 1 desc',
                },
                {
                    id: '2',
                    name: 'Child 1',
                    parentProjectId: '1',
                    description: 'Child 1 desc',
                },
                {
                    id: '3',
                    name: 'Child 2',
                    parentProjectId: '1',
                    description: 'Child 2 desc',
                },
                {
                    id: '1',
                    name: 'Root 1',
                    parentProjectId: '',
                    description: 'Root 1 desc',
                },
                {
                    id: '6',
                    name: 'Child 3',
                    parentProjectId: '5',
                    description: 'Child 3 desc',
                },
                {
                    id: '5',
                    name: 'Root 2',
                    parentProjectId: '',
                    description: 'Root 2 desc',
                },
            ]

            const result = projectsDataStore.organizeFromTheLeafsToRoot(input)

            expect(result).toEqual(expected)
        })

        it('should handle empty input', () => {
            const input: ProjectDefinition[] = []
            const result = projectsDataStore.organizeFromTheLeafsToRoot(input)
            expect(result).toEqual([])
        })

        it('should handle projects with no parent', () => {
            const input = [
                {
                    id: '1',
                    name: 'Root 1',
                    parentProjectId: '',
                    description: 'Root 1 desc',
                },
                {
                    id: '2',
                    name: 'Root 2',
                    parentProjectId: '',
                    description: 'Root 2 desc',
                },
            ]

            const expected = [
                {
                    id: '1',
                    name: 'Root 1',
                    parentProjectId: '',
                    description: 'Root 1 desc',
                },
                {
                    id: '2',
                    name: 'Root 2',
                    parentProjectId: '',
                    description: 'Root 2 desc',
                },
            ]

            const result = projectsDataStore.organizeFromTheLeafsToRoot(input)
            expect(result).toEqual(expected)
        })
    })
})
