import Utils from '../src/utils/Utils'

test('Testing merge objects', () => {
    expect(Utils.mergeObjects({ k1: 'v1' }, {})) //
        .toStrictEqual({ k1: 'v1' })

    expect(Utils.mergeObjects({ k1: 'v1' }, { k2: 'v2' })) //
        .toStrictEqual({ k1: 'v1', k2: 'v2' })

    expect(Utils.mergeObjects({ k1: 'v1', k2: 'v1' }, { k2: 'v2' })) //
        .toStrictEqual({ k1: 'v1', k2: 'v2' })

    expect(
        Utils.mergeObjects(
            {
                k1: 'v1',
                k2: {
                    k21: 'v21',
                    k22: 'v22',
                    k23: ['v23a', 'v23b'],
                    k24: ['v24a', 'v24b'],
                },
            },
            { k2: { k22: 'v22New', k23: ['v23c'] } }
        )
    ) //
        .toStrictEqual({
            k1: 'v1',
            k2: {
                k21: 'v21',
                k22: 'v22New',
                k23: ['v23c'],
                k24: ['v24a', 'v24b'],
            },
        })

    expect(
        Utils.mergeObjects({ k1: 'v1', k2: ['t1', 't2'] }, { k2: ['t3', 't4'] })
    ) //
        .toStrictEqual({ k1: 'v1', k2: ['t3', 't4'] })
})
