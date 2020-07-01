#!/usr/bin/env node

/*jshint esversion: 6 */

// # Get version from constant file
// # Get version from tag
// # Make sure the two are the same
// # Run API request to DockerHub and make sure it's a new version

const requestOriginal = require('request')
const fs = require('fs-extra')

function request(url) {
    return new Promise(function (resolve, reject) {
        requestOriginal(url, function (error, response, body) {
            if (body) {
                body = JSON.parse(body)
            }

            if (error || !body) {
                console.log('Error while fetching tags from Docker Hub!')
                reject(error)
                return
            }

            resolve(body)
        })
    })
}

let publishedNameOnDockerHub = ''
let version = ''

Promise.resolve()
    .then(function () {
        version = require('../built/utils/CaptainConstants').default.configs
            .version
        publishedNameOnDockerHub = require('../built/utils/CaptainConstants')
            .default.configs.publishedNameOnDockerHub

        if (!version || !publishedNameOnDockerHub) {
            throw new Error(
                'Version and publishedNameOnDockerHub must be present'
            )
        }

        var URL = `https://hub.docker.com/v2/repositories/${publishedNameOnDockerHub}/tags`

        return request(URL)
    })
    .then(function (body) {
        if (!body.results || !body.results.length) {
            console.log('Error while fetching tags from Docker Hub!')
            throw error
        }

        var highestTag = ''
        var highestTagValue = 0

        function getTagValue(tag) {
            var sp = tag.split('.')
            return (
                Number(sp[0]) * 1000 * 1000 +
                Number(sp[1]) * 1000 +
                Number(sp[2])
            )
        }

        for (var i = 0; i < body.results.length; i++) {
            var t = body.results[i].name
            var value = getTagValue(t)

            if (value > highestTagValue) {
                highestTagValue = value
                highestTag = t
            }
        }

        var isVersionValid = false

        if (getTagValue(version) > highestTagValue) {
            isVersionValid = true
        }

        if (!isVersionValid || !highestTagValue || !version) {
            console.log(
                `isVersionValid: ${isVersionValid}   highestTagValue: ${highestTagValue}`
            )
            throw new Error(
                'The version you are pushing is not valid! ' + version
            )
        }

        fs.outputFileSync(`./version`, `export CAPROVER_VERSION="${version}"`)
    })
    .catch(function (err) {
        console.error(err)
        process.exit(1)
    })
