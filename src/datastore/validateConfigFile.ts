import fs = require('fs-extra')

export default function validateConfigFile(configPath: string): void {
    if (!fs.pathExistsSync(configPath)) {
        return
    }

    try {
        fs.readJsonSync(configPath)
    } catch {
        throw new Error(
            `Cannot load CapRover configuration from ${configPath}: the file contains malformed JSON. Fix the file or restore it from a backup before restarting CapRover.`
        )
    }
}
