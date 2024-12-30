
/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string | undefined, defaultPort: number): number {
    if (val === undefined) {
        return defaultPort
    }
    const port = parseInt(val, 10)

    if (isNaN(port)) {
        // named pipe
        return defaultPort
    }

    if (port >= 0) {
        // port number
        return port
    }

    return defaultPort
}

export default {
    keys: {
        CAPTAIN_DOCKER_API: 'CAPTAIN_DOCKER_API',
        CAPTAIN_IS_DEBUG: 'CAPTAIN_IS_DEBUG',
        DEFAULT_PASSWORD: 'DEFAULT_PASSWORD',
        IS_CAPTAIN_INSTANCE: 'IS_CAPTAIN_INSTANCE',
        DEMO_MODE_ADMIN_IP: 'DEMO_MODE_ADMIN_IP',
        CAPTAIN_BASE_DIRECTORY: 'CAPTAIN_BASE_DIRECTORY',
        CAPTAIN_HOST_HTTP_PORT: 'CAPTAIN_HOST_HTTP_PORT',
        CAPTAIN_HOST_HTTPS_PORT: 'CAPTAIN_HOST_HTTPS_PORT',
        CAPTAIN_HOST_ADMIN_PORT: 'CAPTAIN_HOST_ADMIN_PORT',
    },

    BY_PASS_PROXY_CHECK: process.env.BY_PASS_PROXY_CHECK,

    CAPTAIN_DOCKER_API: process.env.CAPTAIN_DOCKER_API,

    CAPTAIN_IS_DEBUG: !!process.env.CAPTAIN_IS_DEBUG,

    // Host ports - external to container.  Refer it via CaptainConstants.configs.nginxPortNumber80
    CAPTAIN_HOST_HTTP_PORT: normalizePort(process.env.CAPTAIN_HOST_HTTP_PORT, 80),//Tested with 10080
    // Host ports - external to container.  Refer it via CaptainConstants.configs.nginxPortNumber443
    CAPTAIN_HOST_HTTPS_PORT: normalizePort(process.env.CAPTAIN_HOST_HTTPS_PORT, 443),//Tested with 10443
    // Host ports - external to container.  Refer it via CaptainConstants.configs.adminPortNumber3000
    CAPTAIN_HOST_ADMIN_PORT: normalizePort(process.env.CAPTAIN_HOST_ADMIN_PORT, 3000),//Tested with 13000

    MAIN_NODE_IP_ADDRESS: process.env.MAIN_NODE_IP_ADDRESS,

    ACCEPTED_TERMS: !!process.env.ACCEPTED_TERMS,

    IS_CAPTAIN_INSTANCE: process.env.IS_CAPTAIN_INSTANCE,

    DEMO_MODE_ADMIN_IP: process.env.DEMO_MODE_ADMIN_IP,

    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD,

    FORCE_ENABLE_PRO: process.env.FORCE_ENABLE_PRO,

    CAPROVER_DISABLE_ANALYTICS:
        !!process.env.CAPROVER_DISABLE_ANALYTICS || !!process.env.DO_NOT_TRACK,

    CAPTAIN_BASE_DIRECTORY: process.env.CAPTAIN_BASE_DIRECTORY,
}
