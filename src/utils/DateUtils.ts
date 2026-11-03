const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
]

function pad(value: number, length = 2) {
    return value.toString().padStart(length, '0')
}

function getOrdinalSuffix(day: number) {
    if (day >= 11 && day <= 13) {
        return 'th'
    }

    switch (day % 10) {
        case 1:
            return 'st'
        case 2:
            return 'nd'
        case 3:
            return 'rd'
        default:
            return 'th'
    }
}

export function formatLogDate(date: Date) {
    const day = date.getDate()
    const hours = date.getHours()
    const twelveHour = hours % 12 || 12
    const meridiem = hours < 12 ? 'am' : 'pm'

    return `${MONTHS[date.getMonth()]} ${day}${getOrdinalSuffix(
        day
    )} ${date.getFullYear()}, ${twelveHour}:${pad(date.getMinutes())}:${pad(
        date.getSeconds()
    )}.${pad(date.getMilliseconds(), 3)} ${meridiem}    `
}

export function formatBackupDate(date: Date) {
    return `${date.getFullYear()}_${pad(date.getMonth() + 1)}_${pad(
        date.getDate()
    )}-${pad(date.getHours())}_${pad(date.getMinutes())}_${pad(
        date.getSeconds()
    )}`
}
