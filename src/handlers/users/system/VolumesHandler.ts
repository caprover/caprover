import DataStore from '../../../datastore/DataStore'
import { IAllAppDefinitions } from '../../../models/AppDefinition'
import Logger from '../../../utils/Logger'

export interface VolumeListItem {
    name: string
    usedByAppNames: string[]
}

/**
 * Builds the CapRover-managed named-volume inventory from configured Persistent
 * Directories. Bind-style hostPath entries are deliberately excluded.
 */
export function getManagedVolumes(
    apps: IAllAppDefinitions,
    dataStore: DataStore
): VolumeListItem[] {
    const usedByAppNamesByVolume: { [volumeName: string]: string[] } = {}
    const appsStore = dataStore.getAppsDataStore()

    Object.keys(apps).forEach((appName) => {
        const app = apps[appName]
        ;(app.volumes || []).forEach((vol) => {
            if (!vol.volumeName) {
                return
            }

            const physicalVolumeName = appsStore.getVolumeName(
                vol.volumeName,
                !!app.isLegacyAppName
            )

            if (!usedByAppNamesByVolume[physicalVolumeName]) {
                usedByAppNamesByVolume[physicalVolumeName] = []
            }

            const usedByAppNames = usedByAppNamesByVolume[physicalVolumeName]
            if (usedByAppNames.indexOf(appName) < 0) {
                usedByAppNames.push(appName)
            }
        })
    })

    const volumes = Object.keys(usedByAppNamesByVolume)
        .sort()
        .map((name) => ({
            name,
            usedByAppNames: usedByAppNamesByVolume[name].slice().sort(),
        }))

    Logger.d(
        `Managed volume list built from ${Object.keys(apps).length} app definitions: ${volumes.length} volumes`
    )

    return volumes
}
