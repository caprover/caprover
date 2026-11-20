export function getCapRoverBuiltImageRepo(namespace: string, appName: string) {
    return `img-${namespace}-${appName}`
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Rewrites CapRover-built image names (local or registry-prefixed) when an
 * app is renamed. Third-party images and the placeholder image are left
 * unchanged. The old app name is matched as a full image repository segment
 * so that renaming app-1 does not affect img-captain-app-10.
 */
export function rewriteCapRoverBuiltImageName(
    imageName: string,
    namespace: string,
    oldAppName: string,
    newAppName: string
) {
    if (!imageName || !oldAppName || !newAppName || oldAppName === newAppName) {
        return imageName
    }

    const oldRepo = getCapRoverBuiltImageRepo(namespace, oldAppName)
    const newRepo = getCapRoverBuiltImageRepo(namespace, newAppName)
    const repoPattern = new RegExp(`(^|/)${escapeRegExp(oldRepo)}(?=[:@]|$)`)

    return imageName.replace(repoPattern, `$1${newRepo}`)
}
