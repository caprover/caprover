import type DataStore from '../src/datastore/DataStore'
import type DockerApi from '../src/docker/DockerApi'
import type CertbotManager from '../src/user/system/CertbotManager'
import LoadBalancerManager from '../src/user/system/LoadBalancerManager'

async function getRedirects(
    webApp: Record<string, unknown>,
    hasRootSsl = true
) {
    const dataStore = {
        getAppsDataStore: () => ({
            getAppDefinitions: async () => ({ web: webApp }),
            getServiceName: () => 'srv-captain--web',
        }),
        getGoAccessInfo: async () => ({ isEnabled: false }),
    } as unknown as DataStore
    const servers = await new LoadBalancerManager(
        {} as DockerApi,
        {} as CertbotManager,
        dataStore
    ).getAppsServerConfig(dataStore, '', hasRootSsl, 'root.example.com')
    const redirects: Record<string, string | undefined> = {}
    servers.forEach((s) => (redirects[s.publicDomain] = s.redirectToPath))
    return redirects
}

const app = (redirectDomain: string, targetHasSsl: boolean) => ({
    hasDefaultSubDomainSsl: true,
    redirectDomain,
    customDomain: [
        { publicDomain: 'www.example.com', hasSsl: targetHasSsl },
        { publicDomain: 'example.com', hasSsl: true },
    ],
})

describe('redirect all domains', () => {
    test('uses https when the target domain has ssl', async () => {
        expect(await getRedirects(app('www.example.com', true))).toEqual({
            'web.root.example.com': 'https://www.example.com',
            'www.example.com': undefined,
            'example.com': 'https://www.example.com',
        })
    })

    test('keeps http when the target domain has no ssl', async () => {
        const redirects = await getRedirects(app('www.example.com', false))
        expect(redirects['example.com']).toBe('http://www.example.com')
    })

    test('uses the default subdomain ssl when it is the target', async () => {
        const target = app('web.root.example.com', false)
        expect((await getRedirects(target, true))['example.com']).toBe(
            'https://web.root.example.com'
        )
        expect((await getRedirects(target, false))['example.com']).toBe(
            'http://web.root.example.com'
        )
    })
})
