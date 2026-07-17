import {
    CertCommandGenerator,
    shouldDeleteOrphanedCertificate,
} from '../src/user/system/CertbotManager'

const defaultCommand = 'certbot certonly --domain ${domainName}'
const exampleRule = {
    domain: 'example.com',
    command: 'certbot certonly --manual --preferred-challenges=dns --domain ${domainName}',
}
const wildcardRule = {
    domain: '*',
    command: 'certbot renew',
}
const nullCommandRule = {
    domain: 'fallback.com',
}
const fakeWebroot = '/path/to/webroot'

test('uses default command when no rules match', () => {
    const generator = new CertCommandGenerator([], defaultCommand)
    expect(generator.getCertbotCertCommand('nonmatching.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--domain', 'nonmatching.com' ])
})

test('uses specific rule when domain matches exactly', () => {
    const generator = new CertCommandGenerator([ exampleRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--manual', '--preferred-challenges=dns', '--domain', 'example.com' ])
})

test('uses wildcard rule for any domain', () => {
    const generator = new CertCommandGenerator([ wildcardRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('anything.com', fakeWebroot)).toEqual([ 'certbot', 'renew' ])
})

test('matches subdomain to rule', () => {
    const generator = new CertCommandGenerator([ exampleRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('sub.example.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--manual', '--preferred-challenges=dns', '--domain', 'sub.example.com' ])
})

test('replaces variables in command template', () => {
    const generator = new CertCommandGenerator([], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--domain', 'example.com' ])
})

test('leaves unreplaced placeholders unchanged', () => {
    const generator = new CertCommandGenerator([], 'echo ${missing}')
    expect(generator.getCertbotCertCommand('example.com', fakeWebroot)).toEqual([ 'echo', '${missing}' ])
})

test('first matching rule is used when multiple rules could apply', () => {
    const generator = new CertCommandGenerator([ exampleRule, wildcardRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--manual', '--preferred-challenges=dns', '--domain', 'example.com' ])
})

test('falls back to default command when rule command is null', () => {
    const generator = new CertCommandGenerator([ nullCommandRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('nullcommand.com', fakeWebroot))
        .toEqual([ 'certbot', 'certonly', '--domain', 'nullcommand.com' ])
})

describe('orphaned certificate cleanup', () => {
    const currentTime = Date.parse('2026-07-16T12:00:00Z')

    test('deletes orphaned certificates expiring within 48 hours', () => {
        expect(
            shouldDeleteOrphanedCertificate(
                'expired.example.com',
                [],
                currentTime - 1,
                currentTime
            )
        ).toBe(true)
        expect(
            shouldDeleteOrphanedCertificate(
                '48-hours.example.com',
                [],
                currentTime + 48 * 60 * 60 * 1000,
                currentTime
            )
        ).toBe(true)
    })

    test('keeps orphaned certificates with more than 48 hours remaining', () => {
        expect(
            shouldDeleteOrphanedCertificate(
                '49-hours.example.com',
                [],
                currentTime + 49 * 60 * 60 * 1000,
                currentTime
            )
        ).toBe(false)
    })

    test('keeps active certificates even when they are expired', () => {
        expect(
            shouldDeleteOrphanedCertificate(
                'active.example.com',
                ['ACTIVE.EXAMPLE.COM'],
                currentTime - 1,
                currentTime
            )
        ).toBe(false)
    })
})
