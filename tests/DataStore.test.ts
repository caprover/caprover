import fs = require('fs-extra')
import os = require('os')
import path = require('path')
import { validateConfigFile } from '../src/datastore/DataStore'

describe('DataStore config validation', () => {
    let tempDirectory: string

    beforeEach(() => {
        tempDirectory = fs.mkdtempSync(
            path.join(os.tmpdir(), 'caprover-config-')
        )
    })

    afterEach(() => {
        fs.removeSync(tempDirectory)
    })

    test('does not modify a malformed config file', () => {
        const configPath = path.join(tempDirectory, 'config-captain.json')
        const malformedConfig = '{"namespace":"captain",}'
        fs.writeFileSync(configPath, malformedConfig)

        let validationError: Error | undefined
        try {
            validateConfigFile(configPath)
        } catch (error) {
            validationError = error as Error
        }

        expect(validationError?.message).toBe(
            `Cannot start CapRover because ${configPath} contains invalid JSON. Fix the file or restore it from a backup, then restart CapRover.`
        )
        expect(validationError?.cause).toBeInstanceOf(SyntaxError)
        expect(fs.readFileSync(configPath, 'utf8')).toBe(malformedConfig)
    })

    test('accepts a valid config file', () => {
        const configPath = path.join(tempDirectory, 'config-captain.json')
        fs.writeJsonSync(configPath, { namespace: 'captain' })

        expect(() => validateConfigFile(configPath)).not.toThrow()
    })

    test('accepts a missing config file on first startup', () => {
        const configPath = path.join(tempDirectory, 'config-captain.json')

        expect(() => validateConfigFile(configPath)).not.toThrow()
    })
})
