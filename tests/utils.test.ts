import Utils from '../src/utils/Utils'

test('Testing dropFirstElements - larger', () => {
    const originalArray = []
    for (let index = 0; index < 20; index++) {
        originalArray.push('A' + index)
    }

    expect(Utils.dropFirstElements(originalArray, 2).join(',')) //
        .toBe('A18,A19')
})

test('Testing dropFirstElements - same', () => {
    const originalArray = []
    for (let index = 0; index < 2; index++) {
        originalArray.push('A' + index)
    }

    expect(Utils.dropFirstElements(originalArray, 2).join(',')) //
        .toBe('A0,A1')
})

test('Testing dropFirstElements - smaller', () => {
    const originalArray = []
    for (let index = 0; index < 2; index++) {
        originalArray.push('A' + index)
    }

    expect(Utils.dropFirstElements(originalArray, 3).join(',')) //
        .toBe('A0,A1')
})

test('Testing dropFirstElements - smaller (1)', () => {
    const originalArray = []
    for (let index = 0; index < 1; index++) {
        originalArray.push('A' + index)
    }

    expect(Utils.dropFirstElements(originalArray, 3).join(',')) //
        .toBe('A0')
})

test('Testing dropFirstElements - smaller (0)', () => {
    const originalArray = []
    for (let index = 0; index < 0; index++) {
        originalArray.push('A' + index)
    }

    expect(Utils.dropFirstElements(originalArray, 3).join(',')) //
        .toBe('')
})

interface TestArray {
    val1: string
    val2: string
}

function createTestArray() {
    const originalArray: TestArray[] = []
    for (let index = 0; index < 2; index++) {
        originalArray.push({
            val1: 'e-1-' + (index + 1),
            val2: 'e-2-' + (index + 1),
        })
    }
    return originalArray
}

test('Testing filter in place - remove 1st', () => {
    const originalArray = createTestArray()

    Utils.filterInPlace(originalArray, (v) => v.val1 !== 'e-1-1')
    expect(originalArray.length).toBe(1)
    expect(originalArray[0].val1).toBe('e-1-2')
    expect(originalArray[0].val2).toBe('e-2-2')
})

test('Testing filter in place - remove 2nd', () => {
    const originalArray = createTestArray()

    Utils.filterInPlace(originalArray, (v) => v.val1 !== 'e-1-2')
    expect(originalArray.length).toBe(1)
    expect(originalArray[0].val1).toBe('e-1-1')
    expect(originalArray[0].val2).toBe('e-2-1')
})

test('Testing code to check custom domain', () => {
    const rootDomain = 'google123.ca'
    const appName = 'app1'

    expect(() => Utils.checkCustomDomain('', appName, rootDomain)).toThrow(
        'Domain name is not accepted. Please use alphanumerical domains such as myapp.google123.ca'
    )

    expect(() =>
        Utils.checkCustomDomain('x'.repeat(81), appName, rootDomain)
    ).toThrow(
        'Domain name is not accepted. Please use alphanumerical domains less than 80 characters in length.'
    )

    expect(() =>
        Utils.checkCustomDomain('..google321.ca', appName, rootDomain)
    ).toThrow(
        'Domain name is not accepted. You cannot have two consecutive periods ".." inside a domain name. Please use alphanumerical domains such as myapp.google123.ca'
    )

    expect(() =>
        Utils.checkCustomDomain(`app2.${rootDomain}`, appName, rootDomain)
    ).toThrow(
        'Domain name is not accepted. Custom domain cannot be subdomain of root domain.'
    )

    expect(() =>
        Utils.checkCustomDomain(
            `api.${appName}.${rootDomain}`,
            appName,
            rootDomain
        )
    ).not.toThrow(
        'Domain name is not accepted. Custom domain cannot be subdomain of root domain.'
    )

    expect(() =>
        Utils.checkCustomDomain(`caprover123.ca`, appName, rootDomain)
    ).not.toThrow()
})
