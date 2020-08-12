import Utils from '../src/utils/Utils'

test('Testing JSON/YAML', () => {
    const badYaml = `
version: "3.3"
s

`
    const badJSON = `
{ something:
`

    const goodJSON = `
{
    "version": "3.3",
    "services": {
       "$$cap_appname": {
          "image": "adminer:$$cap_adminer_version",
          "restart": "always",
          "environment": {
             "ADMINER_PLUGINS": "$$cap_adminer_plugins",
             "ADMINER_DESIGN": "$$cap_adminer_design"
          },
          "caproverExtra": {
             "containerHttpPort": "8080"
          }
       }
    },
    "captainVersion": 4,
    "caproverOneClickApp": {
       "variables": [
          {
             "id": "$$cap_adminer_version"
          }
       ]
    }
 }
`

    const goodYAML = `
version: "3.3"
services:
  $$cap_appname:
    image: 'adminer:$$cap_adminer_version'
    restart: always
    environment:
      ADMINER_PLUGINS: $$cap_adminer_plugins
      ADMINER_DESIGN: $$cap_adminer_design
    caproverExtra:
      containerHttpPort: '8080'
### ================================
### CAPROVER ONE CLICK APP SPECIFICS
### ================================
captainVersion: 4
caproverOneClickApp:
  variables:
    - id: $$cap_adminer_version
`

    expect(Utils.convertYamlOrJsonToObject(badYaml)).toBeUndefined()
    expect(Utils.convertYamlOrJsonToObject(badJSON)).toBeUndefined()

    expect(Utils.convertYamlOrJsonToObject(goodJSON)).toStrictEqual(
        JSON.parse(goodJSON)
    )
    expect(Utils.convertYamlOrJsonToObject(goodYAML)).toStrictEqual(
        JSON.parse(goodJSON)
    )
})
