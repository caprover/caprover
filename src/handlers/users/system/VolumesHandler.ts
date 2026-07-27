import DataStore from '../../../datastore/DataStore'
import { DockerVolumeInfo } from '../../../docker/DockerApi'
import { IAllAppDefinitions } from '../../../models/AppDefinition'
import CaptainConstants from '../../../utils/CaptainConstants'
import Logger from '../../../utils/Logger'

export interface VolumeListItem extends DockerVolumeInfo {
    /**
     * CapRover apps whose named Persistent Directories (IAppVolume.volumeName)
     * resolve to this physical Docker volume name via getVolumeName.
     * Always present (may be []). Bind-only Persistent Directories are ignored.
     */
    usedByAppNames: string[]
    /**
     * Heuristic: name looks CapRover-platform / reserved.
     * Always present. NOT a security boundary — UX copy only.
     */
    isLikelySystem: boolean
}

/**
 * Heuristic only — NOT ownership proof or access control.
 *
 * Matches reserved app names (captain, registry), namespace-prefixed platform
 * names (captain-nginx, legacy captain--*), and known CapRover service names.
 *
 * Caveat: legacy user volumes (`captain--*`) also match the prefix rule.
 * Prefer usedByAppNames for share/orphan logic; use isLikelySystem only for
 * softer wording when the name looks platform-ish.
 */
export function isLikelySystemVolumeName(
    physicalName: string,
    namespace: string = CaptainConstants.rootNameSpace
): boolean {
    const name = (physicalName || '').toLowerCase()
    const ns = (namespace || CaptainConstants.rootNameSpace).toLowerCase()

    if (!name) {
        return false
    }

    // Reserved exact names (same set blocked for app names in isNameAllowed)
    if (name === ns || name === 'registry') {
        return true
    }

    // Platform / service prefix: captain-nginx, captain-certbot, ...
    // Also matches legacy physical prefix captain--* (captain-- starts with captain-)
    if (name.startsWith(ns + '-')) {
        return true
    }

    // Explicit known CapRover Docker object names (defense in depth)
    const knownSystemNames = [
        CaptainConstants.nginxServiceName,
        CaptainConstants.captainServiceName,
        CaptainConstants.certbotServiceName,
        CaptainConstants.registryServiceName,
        CaptainConstants.goAccessContainerName,
        CaptainConstants.netDataContainerName,
    ].map((n) => n.toLowerCase())

    if (knownSystemNames.indexOf(name) >= 0) {
        return true
    }

    return false
}

/**
 * Join Docker physical volume names to CapRover apps via named Persistent
 * Directories only (skip bind-style hostPath entries).
 */
export function enrichVolumesWithAppUsage(
    volumes: DockerVolumeInfo[],
    apps: IAllAppDefinitions,
    dataStore: DataStore,
    namespace: string = CaptainConstants.rootNameSpace
): VolumeListItem[] {
    const physicalToApps: { [physicalName: string]: string[] } = {}
    const appsStore = dataStore.getAppsDataStore()

    Object.keys(apps).forEach((appName) => {
        const app = apps[appName]
        ;(app.volumes || []).forEach((vol) => {
            // Named Persistent Directory only; skip bind-style hostPath entries
            if (!vol.volumeName) {
                return
            }

            const physical = appsStore.getVolumeName(
                vol.volumeName,
                !!app.isLegacyAppName
            )

            if (!physicalToApps[physical]) {
                physicalToApps[physical] = []
            }

            if (physicalToApps[physical].indexOf(appName) < 0) {
                physicalToApps[physical].push(appName)
            }
        })
    })

    Logger.d(
        `Volume enrichment: ${Object.keys(physicalToApps).length} physical names referenced by apps`
    )

    return volumes.map((v) => ({
        ...v,
        usedByAppNames: physicalToApps[v.name] || [],
        isLikelySystem: isLikelySystemVolumeName(v.name, namespace),
    }))
}

/** Stable ascending sort by physical volume name (API contract). */
export function sortVolumesByName(volumes: VolumeListItem[]): VolumeListItem[] {
    return volumes.slice().sort(function (a, b) {
        if (a.name < b.name) {
            return -1
        }
        if (a.name > b.name) {
            return 1
        }
        return 0
    })
}
