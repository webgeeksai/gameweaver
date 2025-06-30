/**
 * Generic Object Pool implementation for memory optimization
 * Reduces garbage collection pressure by reusing objects
 */

export interface PoolableObject {
  reset(): void;
  isInUse(): boolean;
}

export interface PoolStats {
  available: number;
  active: number;
  total: number;
  created: number;
  acquired: number;
  released: number;
  peak: number;
}

export class ObjectPool<T extends PoolableObject> {
  private available: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;
  private reset: (obj: T) => void;
  private maxSize: number;
  private growthFactor: number;

  // Pool statistics for monitoring
  private stats: PoolStats = {
    available: 0,
    active: 0,
    total: 0,
    created: 0,
    acquired: 0,
    released: 0,
    peak: 0
  };

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize: number = 10,
    maxSize: number = 1000,
    growthFactor: number = 1.5
  ) {
    this.factory = factory;
    this.reset = reset;
    this.maxSize = maxSize;
    this.growthFactor = growthFactor;

    // Pre-populate pool
    this.grow(initialSize);
  }

  acquire(): T {
    let obj = this.available.pop();

    if (!obj) {
      if (this.getTotalSize() < this.maxSize) {
        obj = this.factory();
        this.stats.created++;
      } else {
        throw new Error('Object pool exhausted');
      }
    }

    this.active.add(obj);
    this.stats.acquired++;
    this.stats.active = this.active.size;
    this.stats.available = this.available.length;
    this.stats.peak = Math.max(this.stats.peak, this.stats.active);

    return obj;
  }

  release(obj: T): void {
    if (!this.active.has(obj)) {
      console.warn('Attempting to release object not from this pool');
      return;
    }

    this.active.delete(obj);
    this.reset(obj);

    // Only return to pool if under capacity
    if (this.available.length < this.maxSize / 2) {
      this.available.push(obj);
    }

    this.stats.released++;
    this.stats.active = this.active.size;
    this.stats.available = this.available.length;
  }

  releaseAll(): void {
    for (const obj of this.active) {
      this.reset(obj);
      if (this.available.length < this.maxSize / 2) {
        this.available.push(obj);
      }
    }

    this.stats.released += this.active.size;
    this.active.clear();
    this.stats.active = 0;
    this.stats.available = this.available.length;
  }

  private grow(count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.getTotalSize() >= this.maxSize) break;

      const obj = this.factory();
      this.available.push(obj);
      this.stats.created++;
    }

    this.stats.available = this.available.length;
    this.stats.total = this.getTotalSize();
  }

  getTotalSize(): number {
    return this.available.length + this.active.size;
  }

  getStats(): PoolStats {
    return { 
      ...this.stats,
      total: this.getTotalSize()
    };
  }

  // Cleanup unused objects to free memory
  trim(): void {
    const targetSize = Math.max(10, this.active.size);
    while (this.available.length > targetSize) {
      this.available.pop();
    }
    this.stats.available = this.available.length;
    this.stats.total = this.getTotalSize();
  }

  // Clear all objects from the pool
  clear(): void {
    this.available = [];
    this.active.clear();
    this.stats.available = 0;
    this.stats.active = 0;
    this.stats.total = 0;
  }

  // Get utilization percentage
  getUtilization(): number {
    const total = this.getTotalSize();
    return total > 0 ? (this.active.size / total) * 100 : 0;
  }

  // Check if pool needs to grow
  shouldGrow(): boolean {
    return this.available.length === 0 && this.getTotalSize() < this.maxSize;
  }

  // Auto-grow the pool if needed
  autoGrow(): void {
    if (this.shouldGrow()) {
      const growthSize = Math.min(
        Math.floor(this.getTotalSize() * (this.growthFactor - 1)),
        this.maxSize - this.getTotalSize()
      );
      this.grow(Math.max(1, growthSize));
    }
  }
}

// Pool manager for centralized pool management
export class PoolManager {
  private pools: Map<string, ObjectPool<any>> = new Map();

  registerPool<T extends PoolableObject>(
    name: string, 
    pool: ObjectPool<T>
  ): void {
    this.pools.set(name, pool);
  }

  getPool<T extends PoolableObject>(name: string): ObjectPool<T> | null {
    return this.pools.get(name) || null;
  }

  // Get statistics for all pools
  getAllStats(): Map<string, PoolStats> {
    const stats = new Map<string, PoolStats>();
    for (const [name, pool] of this.pools) {
      stats.set(name, pool.getStats());
    }
    return stats;
  }

  // Trim all pools to free memory
  trimAll(): void {
    for (const pool of this.pools.values()) {
      pool.trim();
    }
  }

  // Clear all pools
  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
  }

  // Get total memory usage across all pools
  getTotalUtilization(): number {
    let totalActive = 0;
    let totalSize = 0;

    for (const pool of this.pools.values()) {
      const stats = pool.getStats();
      totalActive += stats.active;
      totalSize += stats.total;
    }

    return totalSize > 0 ? (totalActive / totalSize) * 100 : 0;
  }
}

// Global pool manager instance
export const poolManager = new PoolManager();