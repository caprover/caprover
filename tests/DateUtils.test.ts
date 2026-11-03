import { formatBackupDate, formatLogDate } from '../src/utils/DateUtils'

describe('DateUtils', () => {
    test.each([
        [1, 'January 1st 2026, 12:05:04.009 am    '],
        [2, 'January 2nd 2026, 12:05:04.009 am    '],
        [3, 'January 3rd 2026, 12:05:04.009 am    '],
        [11, 'January 11th 2026, 12:05:04.009 am    '],
        [12, 'January 12th 2026, 12:05:04.009 am    '],
        [13, 'January 13th 2026, 12:05:04.009 am    '],
        [21, 'January 21st 2026, 12:05:04.009 am    '],
    ])('formats log timestamps for day %i', (day, expected) => {
        expect(formatLogDate(new Date(2026, 0, day, 0, 5, 4, 9))).toBe(expected)
    })

    test('formats afternoon log timestamps', () => {
        expect(formatLogDate(new Date(2026, 8, 7, 19, 5, 4, 9))).toBe(
            'September 7th 2026, 7:05:04.009 pm    '
        )
    })

    test('formats backup timestamps', () => {
        expect(formatBackupDate(new Date(2026, 8, 7, 19, 5, 4, 9))).toBe(
            '2026_09_07-19_05_04'
        )
    })
})
