export default {
    keys: {
        CAPTAIN_DOCKER_API: 'CAPTAIN_DOCKER_API',
        CAPTAIN_IS_DEBUG: 'CAPTAIN_IS_DEBUG',
        DEFAULT_PASSWORD: 'DEFAULT_PASSWORD',
        IS_CAPTAIN_INSTANCE: 'IS_CAPTAIN_INSTANCE',
        DEMO_MODE_ADMIN_IP: 'DEMO_MODE_ADMIN_IP',
        NGINX_HTTP_PORT: 'NGINX_HTTP_PORT',
        NGINX_HTTPS_PORT: 'NGINX_HTTPS_PORT',
    },

    BY_PASS_PROXY_CHECK: process.env.BY_PASS_PROXY_CHECK,

    CAPTAIN_DOCKER_API: process.env.CAPTAIN_DOCKER_API,

    CAPTAIN_IS_DEBUG: !!process.env.CAPTAIN_IS_DEBUG,

    MAIN_NODE_IP_ADDRESS: process.env.MAIN_NODE_IP_ADDRESS,

    IS_CAPTAIN_INSTANCE: process.env.IS_CAPTAIN_INSTANCE,

    DEMO_MODE_ADMIN_IP: process.env.DEMO_MODE_ADMIN_IP,

    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD,

    NGINX_HTTP_PORT: parseInt(
        process.env.NGINX_HTTP_PORT ? process.env.NGINX_HTTP_PORT : '80'
    ),

    NGINX_HTTPS_PORT: parseInt(
        process.env.NGINX_HTTPS_PORT ? process.env.NGINX_HTTPS_PORT : '443'
    ),

    CAPTAIN_IMAGE_NAME: process.env.CAPTAIN_IMAGE_NAME
        ? process.env.CAPTAIN_IMAGE_NAME
        : 'caprover/caprover',

    CAPTAIN_IMAGE_VERSION: process.env.CAPTAIN_IMAGE_VERSION
        ? process.env.CAPTAIN_IMAGE_VERSION
        : 'latest',
}
