export class RingBuffer<T> {
  private readonly values: Array<T | undefined>;
  private cursor = 0;
  private length = 0;

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError('RingBuffer capacity must be a positive integer');
    }
    this.values = new Array<T | undefined>(capacity);
  }

  push(value: T): void {
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
  }

  clear(): void {
    this.values.fill(undefined);
    this.cursor = 0;
    this.length = 0;
  }

  toArray(): T[] {
    const result: T[] = [];
    const start = (this.cursor - this.length + this.capacity) % this.capacity;
    for (let index = 0; index < this.length; index += 1) {
      const value = this.values[(start + index) % this.capacity];
      if (value !== undefined) {
        result.push(value);
      }
    }
    return result;
  }
}
