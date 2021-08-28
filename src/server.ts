#!/usr/bin/env node

console.log('Captain Starting ...')

// Check if Captain is running as an installer or not.
import * as http from 'http'
import app, { initializeCaptainWithDelay } from './app'
import { AnyError } from './models/OtherTypes'
import CaptainConstants from './utils/CaptainConstants'
import * as CaptainInstaller from './utils/CaptainInstaller'
import EnvVars from './utils/EnvVars'
import debugModule = require('debug')

const debug = debugModule('caprover:server')

function startServer() {
    if (CaptainConstants.isDebug) {
        console.log('***DEBUG BUILD***')
    }

    if (!EnvVars.IS_CAPTAIN_INSTANCE) {
        console.log('Installing Captain Service ...')
        CaptainInstaller.install()
        return
    }

    initializeCaptainWithDelay()

    /**
     * Get port from environment and store in Express.
     */

    const port = normalizePort(process.env.PORT || '3000')
    app.set('port', port)

    /**
     * Create HTTP server.
     */

    const server = http.createServer(app)

    /**
     * Listen on provided port, on all network interfaces.
     */

    server.listen(port)
    server.on('error', onError)
    server.on('listening', onListening)

    /**
     * Normalize a port into a number, string, or false.
     */

    function normalizePort(val: string) {
        const port = parseInt(val, 10)

        if (isNaN(port)) {
            // named pipe
            return val
        }

        if (port >= 0) {
            // port number
            return port
        }

        return false
    }

    /**
     * Event listener for HTTP server "error" event.
     */

    function onError(error: AnyError) {
        if (error.syscall !== 'listen') {
            throw error
        }

        const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.error(bind + ' requires elevated privileges')
                process.exit(1)
                break
            case 'EADDRINUSE':
                console.error(bind + ' is already in use')
                process.exit(1)
                break
            default:
                throw error
        }
    }

    /**
     * Event listener for HTTP server "listening" event.
     */

    function onListening() {
        const addr = server.address()
        const bind =
            typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port
        debug('Listening on ' + bind)
    }
}

startServer()
