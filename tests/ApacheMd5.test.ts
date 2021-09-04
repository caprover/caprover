import ApacheMd5 from '../src/utils/ApacheMd5'

test('apache_test', () => {
    // Test for valid password.
    {
        const encrypted = ApacheMd5.createApacheHash(
            'su/P3R%se#ret!',
            '$apr1$cF.rAvCe$YlzjmK4qu/ia6hC8CNfnm/'
        )
        expect(encrypted).toBe('$apr1$cF.rAvCe$YlzjmK4qu/ia6hC8CNfnm/')
    }

    // Test for valid short password.
    {
        const encrypted = ApacheMd5.createApacheHash(
            '123456',
            '$1$VV5.4y5.$JbhytGQBPmDHBbrSjF2i7.'
        )
        expect(encrypted).toBe('$1$VV5.4y5.$JbhytGQBPmDHBbrSjF2i7.')
    }

    // Test for invalid password.
    {
        const encrypted =
            ApacheMd5.createApacheHash(
                'invalidPass',
                '$apr1$cF.rAvCe$YlzjmK4qu/ia6hC8CNfnm/'
            ) == '$apr1$cF.rAvCe$YlzjmK4qu/ia6hC8CNfnm/'
        expect(encrypted).toBeFalsy()
    }

    // Test for invalid short password.
    {
        const encrypted =
            ApacheMd5.createApacheHash(
                'passw0rdpa55wore',
                '$1$VV5.4y5.$9981ZZhKTHmeXFKQur4cV0'
            ) == '$1$VV5.4y5.$9981ZZhKTHmeXFKQur4cV0'
        expect(encrypted).toBeFalsy()
    }
})
