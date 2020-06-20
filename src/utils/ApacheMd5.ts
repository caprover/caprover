// TypeScript version of https://github.com/http-auth/apache-md5
// Project is licensed under MIT. https://github.com/http-auth/apache-md5/blob/master/LICENSE

// Crypto module import.
const crypto = require('crypto')

// Hash generation string.
const itoa64 =
    './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export default class ApacheMd5 {
    // To 64 bit version.
    static to64(index: number, count: number) {
        let result = ''

        while (--count >= 0) {
            // Result char count.
            result += itoa64[index & 63] // Get corresponding char.
            index = index >> 6 // Move to next one.
        }

        return result
    }

    // Returns salt.
    static getSalt(inputSalt: string | undefined) {
        let salt = ''

        if (inputSalt) {
            // Remove $apr1$ token and extract salt.
            salt = inputSalt.split('$')[2]
        } else {
            while (salt.length < 8) {
                // Random 8 chars.
                let rchIndex = Math.floor(Math.random() * 64)
                salt += itoa64[rchIndex]
            }
        }

        return salt
    }

    // Returns password.
    static getPassword(final: string) {
        // Encrypted pass.
        let epass = ''

        epass += ApacheMd5.to64(
            (final.charCodeAt(0) << 16) |
                (final.charCodeAt(6) << 8) |
                final.charCodeAt(12),
            4
        )
        epass += ApacheMd5.to64(
            (final.charCodeAt(1) << 16) |
                (final.charCodeAt(7) << 8) |
                final.charCodeAt(13),
            4
        )
        epass += ApacheMd5.to64(
            (final.charCodeAt(2) << 16) |
                (final.charCodeAt(8) << 8) |
                final.charCodeAt(14),
            4
        )
        epass += ApacheMd5.to64(
            (final.charCodeAt(3) << 16) |
                (final.charCodeAt(9) << 8) |
                final.charCodeAt(15),
            4
        )
        epass += ApacheMd5.to64(
            (final.charCodeAt(4) << 16) |
                (final.charCodeAt(10) << 8) |
                final.charCodeAt(5),
            4
        )
        epass += ApacheMd5.to64(final.charCodeAt(11), 2)

        return epass
    }

    // Exporting old style.
    static createApacheHash(password: string, salt?: string) {
        let magic = ''
        if (salt && salt.split('$')[1] === '1') {
            magic = '$1$'
        } else {
            magic = '$apr1$'
        }

        salt = ApacheMd5.getSalt(salt)

        let ctx = password + magic + salt
        let final = crypto
            .createHash('md5')
            .update(password + salt + password, 'ascii')
            .digest('binary')

        for (let pl = password.length; pl > 0; pl -= 16) {
            ctx += final.substr(0, pl > 16 ? 16 : pl)
        }

        for (let i = password.length; i; i >>= 1) {
            if (i % 2) {
                ctx += String.fromCharCode(0)
            } else {
                ctx += password.charAt(0)
            }
        }

        final = crypto.createHash('md5').update(ctx, 'ascii').digest('binary')

        // 1000 loop.
        for (let i = 0; i < 1000; ++i) {
            // Weird stuff.
            let ctxl = ''

            if (i % 2) {
                ctxl += password
            } else {
                ctxl += final.substr(0, 16)
            }

            if (i % 3) {
                ctxl += salt
            }

            if (i % 7) {
                ctxl += password
            }

            if (i % 2) {
                ctxl += final.substr(0, 16)
            } else {
                ctxl += password
            }

            // Final assignment after each loop.
            final = crypto
                .createHash('md5')
                .update(ctxl, 'ascii')
                .digest('binary')
        }

        return magic + salt + '$' + ApacheMd5.getPassword(final)
    }
}
