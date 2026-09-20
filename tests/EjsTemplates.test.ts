import ejs = require('ejs')
import fs = require('fs')
import path = require('path')

const templates: [string, Record<string, unknown>][] = [
    [
        'base-nginx-conf.ejs',
        {
            base: { dhparamsFilePath: '/etc/nginx/dhparam.pem' },
        },
    ],
    [
        'default-page.ejs',
        {
            message_title: 'CapRover',
            message_body: 'Ready',
            message_link: 'https://caprover.com',
            message_link_title: 'Documentation',
        },
    ],
    [
        'root-nginx-conf.ejs',
        {
            fake: { crtPath: '/fake.crt', keyPath: '/fake.key' },
            captain: {
                hasRootSsl: true,
                crtPath: '/captain.crt',
                keyPath: '/captain.key',
                domain: 'captain.example.com',
                serviceName: 'captain-captain',
                serviceContainerPort3000: 3000,
                staticWebRoot: '/captain/static',
                defaultHtmlDir: '/captain/default',
            },
            registry: {
                hasRootSsl: false,
                domain: 'registry.example.com',
                staticWebRoot: '/registry/static',
            },
        },
    ],
    [
        'server-block-conf.ejs',
        {
            s: {
                forceSsl: true,
                publicDomain: 'app.example.com',
                staticWebRoot: '/app/static',
                hasSsl: true,
                crtPath: '/app.crt',
                keyPath: '/app.key',
                logAccessPath: '',
                gzipOn: false,
                localDomain: 'srv-captain--app',
                containerHttpPort: 3000,
                redirectToPath: '',
                httpBasicAuthPath: '',
                websocketSupport: true,
                customErrorPagesDirectory: '/captain/error-pages',
            },
        },
    ],
]

describe('EJS nginx templates', () => {
    test.each(templates)('renders %s', (filename, data) => {
        const template = fs.readFileSync(
            path.join(__dirname, '..', 'template', filename),
            'utf8'
        )

        expect(ejs.render(template, data)).toBeTruthy()
    })

    test('keeps Captain connections alive across the NGINX reload boundary', () => {
        const template = fs.readFileSync(
            path.join(__dirname, '..', 'template', 'root-nginx-conf.ejs'),
            'utf8'
        )
        const rootTemplateData = templates.find(
            ([filename]) => filename === 'root-nginx-conf.ejs'
        )![1]

        const rendered = ejs.render(template, rootTemplateData)

        expect(rendered).toContain('keepalive_min_timeout 1s;')
    })
})
