export class RingBuffer extends Array<number> {
    private index = 0;

    constructor(size: number) {
        super(size);
    }

    push(...items: number[]): number {
        for (const item of items) {
            this[this.index] = item;
            this.index = (this.index + 1) % this.length;
        }
        return this.length;
    }
}