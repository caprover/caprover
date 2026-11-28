import * as fs from 'fs-extra'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import * as tar from 'tar'
import ApiStatusCodes from '../src/api/ApiStatusCodes'
import ImageMaker from '../src/user/ImageMaker'

describe('ImageMaker build context', () => {
    let root: string

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(tmpdir(), 'caprover-build-context-'))
        const files = [
            'Dockerfile',
            'index.js',
            'README.md',
            'CHANGELOG.md',
            '.git/config',
            'docs/keep.txt',
            'docs/other.txt',
            'src/notes.md',
        ]
        for (const file of files) {
            await fs.outputFile(path.join(root, 'source', file), file)
        }
    })

    afterEach(async () => {
        await fs.remove(root)
    })

    async function buildContextEntries() {
        const imageMaker = new ImageMaker(
            {} as any,
            {} as any,
            'captain',
            {} as any
        )
        const tarFilePath = path.join(root, 'image.tar')
        await (imageMaker as any).convertContentOfDirectoryIntoTar(
            path.join(root, 'source'),
            tarFilePath
        )

        const entries: string[] = []
        await tar.t({
            file: tarFilePath,
            onReadEntry: (entry) => {
                if (entry.type === 'File') entries.push(entry.path)
            },
        })
        return entries.sort()
    }

    test('sends every file when there is no .dockerignore', async () => {
        expect(await buildContextEntries()).toEqual([
            '.git/config',
            'CHANGELOG.md',
            'Dockerfile',
            'README.md',
            'docs/keep.txt',
            'docs/other.txt',
            'index.js',
            'src/notes.md',
        ])
    })

    test('leaves out files matched by .dockerignore', async () => {
        await fs.outputFile(
            path.join(root, 'source', '.dockerignore'),
            [
                '# comment',
                '.git',
                '*.md',
                '!README.md',
                'docs',
                '!docs/keep.txt',
                'Dockerfile',
                '.dockerignore',
            ].join('\n')
        )

        expect(await buildContextEntries()).toEqual([
            '.dockerignore',
            'Dockerfile',
            'README.md',
            'docs/keep.txt',
            'index.js',
            'src/notes.md',
        ])
    })

    test('matches regular expression characters literally', async () => {
        const files = ['config(prod).json', 'a+b.txt', 'x{1}|y.txt', 'k(1).txt']
        for (const file of files) {
            await fs.outputFile(path.join(root, 'source', file), file)
        }
        await fs.outputFile(
            path.join(root, 'source', '.dockerignore'),
            ['config(prod).json', 'a+b.txt', 'x{1}|y.txt', 'k\\(1\\).txt'].join(
                '\n'
            )
        )

        expect(await buildContextEntries()).toEqual([
            '.dockerignore',
            '.git/config',
            'CHANGELOG.md',
            'Dockerfile',
            'README.md',
            'docs/keep.txt',
            'docs/other.txt',
            'index.js',
            'src/notes.md',
        ])
    })

    test('rejects an invalid pattern', async () => {
        await fs.outputFile(path.join(root, 'source', '.dockerignore'), '[')

        await expect(buildContextEntries()).rejects.toMatchObject({
            captainErrorType: ApiStatusCodes.BUILD_ERROR,
            message: expect.stringContaining('Invalid .dockerignore'),
        })
    })
})
