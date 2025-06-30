/**
 * Asset Registry
 * 
 * Maintains a registry of all available assets in the project,
 * their metadata, and dependencies.
 */

import { AssetMetadata } from './UnifiedAssetManager';
import { AssetType } from '../types';
import { EventEmitter } from 'events';

export interface AssetEntry {
  id: string;
  metadata: AssetMetadata;
  source: 'project' | 'builtin' | 'external';
  dependencies: string[];
  dependents: string[];
  lastModified?: number;
  checksum?: string;
}

export interface AssetRegistryEvents {
  'registry:updated': { entries: AssetEntry[] };
  'registry:asset-added': { entry: AssetEntry };
  'registry:asset-removed': { id: string };
  'registry:asset-modified': { entry: AssetEntry };
}

/**
 * Asset Registry
 * 
 * Central registry of all game assets with dependency tracking
 */
export class AssetRegistry extends EventEmitter {
  private entries: Map<string, AssetEntry> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private watchHandlers: Map<string, () => void> = new Map();

  constructor() {
    super();
    this.loadBuiltinAssets();
  }

  /**
   * Load built-in assets
   */
  private loadBuiltinAssets(): void {
    // Register default built-in assets
    const builtinAssets: AssetEntry[] = [
      {
        id: 'default-sprite',
        metadata: {
          name: 'Default Sprite',
          type: AssetType.Sprite,
          path: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRkY2QjZCIi8+Cjwvc3ZnPg==',
          width: 32,
          height: 32,
          format: 'svg',
          size: 256
        },
        source: 'builtin',
        dependencies: [],
        dependents: []
      },
      {
        id: 'default-sound',
        metadata: {
          name: 'Default Sound',
          type: AssetType.Sound,
          path: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAB9wAAAfcAAABAAgAZGF0YQAAAAA=',
          duration: 0,
          format: 'wav',
          size: 36
        },
        source: 'builtin',
        dependencies: [],
        dependents: []
      },
      {
        id: 'default-font',
        metadata: {
          name: 'Default Font',
          type: AssetType.Font,
          path: 'system:default',
          format: 'system'
        },
        source: 'builtin',
        dependencies: [],
        dependents: []
      }
    ];

    for (const asset of builtinAssets) {
      this.register(asset);
    }
  }

  /**
   * Register an asset
   */
  register(entry: AssetEntry): void {
    this.entries.set(entry.id, entry);
    
    // Update dependency graph
    this.updateDependencyGraph(entry);

    // Emit event
    this.emit('registry:asset-added', { entry });
    this.emit('registry:updated', { entries: Array.from(this.entries.values()) });

    console.log(`Asset registered: ${entry.id}`);
  }

  /**
   * Unregister an asset
   */
  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;

    // Check if any assets depend on this
    if (entry.dependents.length > 0) {
      throw new Error(`Cannot unregister asset ${id}: Other assets depend on it`);
    }

    // Remove from registry
    this.entries.delete(id);

    // Update dependency graph
    this.removeDependencies(id);

    // Remove watch handler if any
    const watchHandler = this.watchHandlers.get(id);
    if (watchHandler) {
      watchHandler();
      this.watchHandlers.delete(id);
    }

    // Emit event
    this.emit('registry:asset-removed', { id });
    this.emit('registry:updated', { entries: Array.from(this.entries.values()) });

    console.log(`Asset unregistered: ${id}`);
  }

  /**
   * Get an asset entry
   */
  get(id: string): AssetEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all entries
   */
  getAll(): AssetEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Get entries by type
   */
  getByType(type: AssetType): AssetEntry[] {
    return this.getAll().filter(entry => entry.metadata.type === type);
  }

  /**
   * Get entries by source
   */
  getBySource(source: 'project' | 'builtin' | 'external'): AssetEntry[] {
    return this.getAll().filter(entry => entry.source === source);
  }

  /**
   * Search assets
   */
  search(query: string): AssetEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(entry => {
      const metadata = entry.metadata;
      return metadata.name.toLowerCase().includes(lowerQuery) ||
             metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
             entry.id.toLowerCase().includes(lowerQuery);
    });
  }

  /**
   * Update asset metadata
   */
  updateMetadata(id: string, metadata: Partial<AssetMetadata>): void {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Asset not found: ${id}`);
    }

    // Update metadata
    entry.metadata = { ...entry.metadata, ...metadata };
    entry.lastModified = Date.now();

    // Emit event
    this.emit('registry:asset-modified', { entry });
    this.emit('registry:updated', { entries: Array.from(this.entries.values()) });
  }

  /**
   * Update dependency graph
   */
  private updateDependencyGraph(entry: AssetEntry): void {
    // Clear old dependencies
    this.removeDependencies(entry.id);

    // Add new dependencies
    if (entry.dependencies.length > 0) {
      const deps = new Set(entry.dependencies);
      this.dependencyGraph.set(entry.id, deps);

      // Update dependents
      for (const depId of entry.dependencies) {
        const depEntry = this.entries.get(depId);
        if (depEntry && !depEntry.dependents.includes(entry.id)) {
          depEntry.dependents.push(entry.id);
        }
      }
    }
  }

  /**
   * Remove dependencies
   */
  private removeDependencies(id: string): void {
    const deps = this.dependencyGraph.get(id);
    if (deps) {
      // Remove from dependents
      for (const depId of deps) {
        const depEntry = this.entries.get(depId);
        if (depEntry) {
          depEntry.dependents = depEntry.dependents.filter(d => d !== id);
        }
      }
      
      this.dependencyGraph.delete(id);
    }
  }

  /**
   * Get asset dependencies (recursive)
   */
  getDependencies(id: string, recursive: boolean = false): string[] {
    const entry = this.entries.get(id);
    if (!entry) return [];

    if (!recursive) {
      return entry.dependencies;
    }

    // Recursive dependency resolution
    const allDeps = new Set<string>();
    const queue = [...entry.dependencies];

    while (queue.length > 0) {
      const depId = queue.shift()!;
      if (allDeps.has(depId)) continue;

      allDeps.add(depId);
      
      const depEntry = this.entries.get(depId);
      if (depEntry) {
        queue.push(...depEntry.dependencies);
      }
    }

    return Array.from(allDeps);
  }

  /**
   * Get asset dependents (what depends on this asset)
   */
  getDependents(id: string): string[] {
    const entry = this.entries.get(id);
    return entry?.dependents || [];
  }

  /**
   * Check for circular dependencies
   */
  hasCircularDependency(id: string): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const checkCycle = (assetId: string): boolean => {
      visited.add(assetId);
      recursionStack.add(assetId);

      const entry = this.entries.get(assetId);
      if (entry) {
        for (const depId of entry.dependencies) {
          if (!visited.has(depId)) {
            if (checkCycle(depId)) return true;
          } else if (recursionStack.has(depId)) {
            return true;
          }
        }
      }

      recursionStack.delete(assetId);
      return false;
    };

    return checkCycle(id);
  }

  /**
   * Validate registry
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [id, entry] of this.entries) {
      // Check for missing dependencies
      for (const depId of entry.dependencies) {
        if (!this.entries.has(depId)) {
          errors.push(`Asset ${id} has missing dependency: ${depId}`);
        }
      }

      // Check for circular dependencies
      if (this.hasCircularDependency(id)) {
        errors.push(`Asset ${id} has circular dependencies`);
      }

      // Validate metadata
      if (!entry.metadata.name) {
        errors.push(`Asset ${id} has no name`);
      }
      if (!entry.metadata.path) {
        errors.push(`Asset ${id} has no path`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export registry to JSON
   */
  toJSON(): any {
    const entries: any[] = [];

    for (const entry of this.entries.values()) {
      entries.push({
        id: entry.id,
        metadata: entry.metadata,
        source: entry.source,
        dependencies: entry.dependencies,
        lastModified: entry.lastModified,
        checksum: entry.checksum
      });
    }

    return {
      version: '1.0',
      entries,
      generated: new Date().toISOString()
    };
  }

  /**
   * Import registry from JSON
   */
  fromJSON(data: any): void {
    if (data.version !== '1.0') {
      throw new Error(`Unsupported registry version: ${data.version}`);
    }

    // Clear current registry
    this.entries.clear();
    this.dependencyGraph.clear();

    // Load built-in assets first
    this.loadBuiltinAssets();

    // Import entries
    for (const entryData of data.entries) {
      if (entryData.source === 'builtin') continue; // Skip built-ins

      const entry: AssetEntry = {
        id: entryData.id,
        metadata: entryData.metadata,
        source: entryData.source,
        dependencies: entryData.dependencies || [],
        dependents: [], // Will be rebuilt
        lastModified: entryData.lastModified,
        checksum: entryData.checksum
      };

      this.register(entry);
    }

    console.log(`Imported ${this.entries.size} assets from registry`);
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalAssets: number;
    byType: Record<AssetType, number>;
    bySource: Record<string, number>;
    withDependencies: number;
    totalSize: number;
  } {
    const stats = {
      totalAssets: this.entries.size,
      byType: {} as Record<AssetType, number>,
      bySource: { project: 0, builtin: 0, external: 0 },
      withDependencies: 0,
      totalSize: 0
    };

    for (const entry of this.entries.values()) {
      // Count by type
      const type = entry.metadata.type;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by source
      stats.bySource[entry.source]++;

      // Count dependencies
      if (entry.dependencies.length > 0) {
        stats.withDependencies++;
      }

      // Sum size
      if (entry.metadata.size) {
        stats.totalSize += entry.metadata.size;
      }
    }

    return stats;
  }

  /**
   * Watch for asset changes
   */
  watch(id: string, callback: (entry: AssetEntry) => void): () => void {
    const handler = () => {
      const entry = this.entries.get(id);
      if (entry) {
        callback(entry);
      }
    };

    this.on('registry:asset-modified', (event) => {
      if (event.entry.id === id) {
        handler();
      }
    });

    // Return unwatch function
    return () => {
      this.off('registry:asset-modified', handler);
    };
  }
}