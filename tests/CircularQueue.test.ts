import CircularQueue from '../src/utils/CircularQueue'

function createTest(size: number, initWith: number) {
    const testQueue = new CircularQueue<string>(size)
    for (let index = 0; index < initWith; index++) {
        testQueue.push('val:' + (index + 1))
    }

    return testQueue
}

test('Large Circular Queue', () => {
    for (let index = 5; index < 20; index++) {
        expect(createTest(4, index).peek()) //
            .toBe('val:' + (index - 3))
    }
})

test('Basic Circular Queue', () => {
    expect(createTest(2, 10).peek()) //
        .toBe('val:9')

})

test('Basic Circular Queue', () => {
    expect(createTest(2, 1).peek()) //
        .toBe(undefined)
})

test('Basic Circular Queue', () => {
    expect(createTest(2, 2).peek()) //
        .toBe('val:1')
})

test('Basic Circular Queue', () => {
    expect(createTest(2, 3).peek()) //
        .toBe('val:2')
})
