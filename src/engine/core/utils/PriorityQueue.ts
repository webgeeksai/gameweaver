/**
 * Priority Queue implementation for the Game Vibe Engine
 * Used for event processing and task scheduling
 */

export class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  constructor() {
    this.items = [];
  }

  /**
   * Add an item to the queue with a specified priority
   * Higher priority values are processed first
   */
  enqueue(item: T, priority: number): void {
    const element = { item, priority };
    let added = false;

    // Add item in the correct position based on priority
    for (let i = 0; i < this.items.length; i++) {
      if (priority > this.items[i].priority) {
        this.items.splice(i, 0, element);
        added = true;
        break;
      }
    }

    // If item has the lowest priority, add it to the end
    if (!added) {
      this.items.push(element);
    }
  }

  /**
   * Remove and return the highest priority item
   */
  dequeue(): T {
    if (this.isEmpty()) {
      throw new Error('Queue is empty');
    }
    return this.items.shift()!.item;
  }

  /**
   * Look at the highest priority item without removing it
   */
  peek(): T {
    if (this.isEmpty()) {
      throw new Error('Queue is empty');
    }
    return this.items[0].item;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Get the number of items in the queue
   */
  size(): number {
    return this.items.length;
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Get all items in the queue (for debugging)
   */
  getItems(): T[] {
    return this.items.map(element => element.item);
  }

  /**
   * Check if the queue contains a specific item
   */
  contains(item: T, comparator: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
    return this.items.some(element => comparator(element.item, item));
  }

  /**
   * Remove a specific item from the queue
   */
  remove(item: T, comparator: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter(element => !comparator(element.item, item));
    return initialLength !== this.items.length;
  }

  /**
   * Update the priority of an item in the queue
   */
  updatePriority(item: T, newPriority: number, comparator: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
    // Remove the item
    const removed = this.remove(item, comparator);
    if (removed) {
      // Add it back with the new priority
      this.enqueue(item, newPriority);
    }
    return removed;
  }
}