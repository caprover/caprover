import { CertCommandGenerator } from '../src/user/system/CertbotManager'

const defaultCommand = [ 'certbot', 'certonly', '--domain', '${domain}' ]
const exampleRule = {
    domain: 'example.com',
    command: [ 'certbot', 'certonly', '--manual', '--preferred-challenges=dns', '--domain', '${domain}' ],
}
const wildcardRule = {
    domain: '*',
    command: [ 'certbot', 'renew' ],
}
const nullCommandRule = {
    domain: 'fallback.com',
}

test('uses default command when no rules match', () => {
    const generator = new CertCommandGenerator([], defaultCommand)
    expect(generator.getCertbotCertCommand('nonmatching.com')).toEqual(defaultCommand)
})

test('uses specific rule when domain matches exactly', () => {
    const generator = new CertCommandGenerator([ exampleRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com')).toEqual(exampleRule.command)
})

test('uses wildcard rule for any domain', () => {
    const generator = new CertCommandGenerator([ wildcardRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('anything.com')).toEqual(wildcardRule.command)
})

test('matches subdomain to rule', () => {
    const generator = new CertCommandGenerator([ exampleRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('sub.example.com')).toEqual(exampleRule.command)
})

test('replaces variables in command template', () => {
    const generator = new CertCommandGenerator([], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com', { 'domain': 'example.com' }))
        .toEqual([ 'certbot', 'certonly', '--domain', 'example.com' ])
})

test('leaves unreplaced placeholders unchanged', () => {
    const generator = new CertCommandGenerator([], [ 'echo', '${missing}' ])
    expect(generator.getCertbotCertCommand('example.com')).toEqual([ 'echo', '${missing}' ])
})

test('first matching rule is used when multiple rules could apply', () => {
    const generator = new CertCommandGenerator([ exampleRule, wildcardRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('example.com')).toEqual(exampleRule.command)
})

test('falls back to default command when rule command is null', () => {
    const generator = new CertCommandGenerator([ nullCommandRule ], defaultCommand)
    expect(generator.getCertbotCertCommand('nullcommand.com')).toEqual(defaultCommand)
})
