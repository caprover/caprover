
export default class CircularQueue<T> {
    private values: (T | undefined)[] = []
    private currSize = 0

    constructor(private maxSize: number) {
        if (!this.maxSize) throw new Error('invalid size of zero')
        if (this.maxSize === 1) throw new Error('invalid size of one')
        for (let index = 0; index < this.maxSize; index++) {
            this.values.push(undefined)
        }
    }

    push(value: T) {
        this.values[this.currSize % this.maxSize] = value
        this.currSize++
    }

    peek(): T | undefined {
        const nextPositionToBeOverwritten = this.currSize % this.maxSize
        return this.values[nextPositionToBeOverwritten]
    }
}
