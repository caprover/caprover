import Logger = require('../utils/Logger')

class BuildLog {
    public isBuildFailed: boolean
    private firstLineNumber: number
    private lines: string[]

    constructor(private size: number) {
        this.clear()
    }

    onBuildFailed(error: string) {
        this.log('----------------------')
        this.log('Deploy failed!')
        this.log(error)
        this.isBuildFailed = true
    }

    clear() {
        this.isBuildFailed = false
        this.firstLineNumber = -this.size
        this.lines = []
        for (let i = 0; i < this.size; i++) {
            this.lines.push('')
        }
    }

    log(msg: string) {
        msg = (msg || '') + ''
        this.lines.shift()
        this.lines.push(msg)
        this.firstLineNumber++
        Logger.dev(msg)
    }

    getLogs() {
        const self = this
        // if we don't copy the object, "lines" can get changed but firstLineNumber stay as is, causing bug!
        return JSON.parse(
            JSON.stringify({
                lines: self.lines,
                firstLineNumber: self.firstLineNumber,
            })
        )
    }
}

export = BuildLog
