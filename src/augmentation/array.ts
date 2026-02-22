Array.prototype.random = function <T>(): T | undefined {
    if (this.length === 0) return undefined;
    const index = Math.floor(Math.random() * this.length);
    return this[index];
}

Array.prototype.sum = function (): number {
    return this.reduce((a, b) => a + b, 0);
}

Array.prototype.avg = function (): number {
    return this.sum() / this.length;
}

Array.prototype.median = function (): number {
    return this.sort()[Math.floor(this.length / 2)];
}
