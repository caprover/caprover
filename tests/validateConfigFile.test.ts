import fs = require('fs-extra')
import os = require('os')
import path = require('path')
import validateConfigFile from '../src/datastore/validateConfigFile'

describe('validateConfigFile', () => {
    let temporaryDirectory: string
    let configPath: string

    beforeEach(() => {
        temporaryDirectory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'caprover-config-')
        )
        configPath = path.join(temporaryDirectory, 'config-captain.json')
    })

    afterEach(() => {
        fs.removeSync(temporaryDirectory)
    })

    test('rejects malformed JSON without modifying the file', () => {
        const malformedConfig = '{"namespace":"captain",}'
        fs.writeFileSync(configPath, malformedConfig)

        expect(() => validateConfigFile(configPath)).toThrow(
            'the file contains malformed JSON'
        )
        expect(fs.readFileSync(configPath, 'utf8')).toBe(malformedConfig)
    })

    test('accepts valid JSON', () => {
        fs.writeJsonSync(configPath, { namespace: 'captain' })

        expect(() => validateConfigFile(configPath)).not.toThrow()
    })

    test('accepts a missing config file for first-time setup', () => {
        expect(() => validateConfigFile(configPath)).not.toThrow()
    })
})
