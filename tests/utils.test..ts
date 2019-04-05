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
