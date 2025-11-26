/**
 * Hybrid Logical Clock (HLC) implementation
 * Combines physical time with a logical counter for ordering events
 */

export interface HLCTimestamp {
  /** Physical time in milliseconds */
  time: number;
  /** Logical counter for same-millisecond events */
  counter: number;
  /** Node ID for tie-breaking */
  node: string;
}

export class HybridLogicalClock {
  private time: number = 0;
  private counter: number = 0;
  private node: string;

  constructor(nodeId: string) {
    this.node = nodeId;
  }

  /**
   * Get the node ID
   */
  getNodeId(): string {
    return this.node;
  }

  /**
   * Generate a new timestamp for a local event
   */
  now(): HLCTimestamp {
    const physicalTime = Date.now();

    if (physicalTime > this.time) {
      this.time = physicalTime;
      this.counter = 0;
    } else {
      this.counter++;
    }

    return {
      time: this.time,
      counter: this.counter,
      node: this.node,
    };
  }

  /**
   * Update the clock based on a received timestamp
   */
  receive(remote: HLCTimestamp): HLCTimestamp {
    const physicalTime = Date.now();
    const maxTime = Math.max(physicalTime, this.time, remote.time);

    if (maxTime === this.time && maxTime === remote.time) {
      this.counter = Math.max(this.counter, remote.counter) + 1;
    } else if (maxTime === this.time) {
      this.counter++;
    } else if (maxTime === remote.time) {
      this.counter = remote.counter + 1;
    } else {
      this.counter = 0;
    }

    this.time = maxTime;

    return {
      time: this.time,
      counter: this.counter,
      node: this.node,
    };
  }

  /**
   * Compare two timestamps
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  static compare(a: HLCTimestamp, b: HLCTimestamp): number {
    if (a.time !== b.time) {
      return a.time < b.time ? -1 : 1;
    }
    if (a.counter !== b.counter) {
      return a.counter < b.counter ? -1 : 1;
    }
    if (a.node !== b.node) {
      return a.node < b.node ? -1 : 1;
    }
    return 0;
  }

  /**
   * Check if timestamp a is before timestamp b
   */
  static isBefore(a: HLCTimestamp, b: HLCTimestamp): boolean {
    return HybridLogicalClock.compare(a, b) < 0;
  }

  /**
   * Check if timestamp a is after timestamp b
   */
  static isAfter(a: HLCTimestamp, b: HLCTimestamp): boolean {
    return HybridLogicalClock.compare(a, b) > 0;
  }

  /**
   * Serialize timestamp to string
   */
  static serialize(ts: HLCTimestamp): string {
    return `${ts.time.toString(36)}-${ts.counter.toString(36)}-${ts.node}`;
  }

  /**
   * Parse timestamp from string
   */
  static parse(str: string): HLCTimestamp {
    const [time, counter, node] = str.split('-');
    return {
      time: parseInt(time, 36),
      counter: parseInt(counter, 36),
      node,
    };
  }
}
