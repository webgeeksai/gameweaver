/**
 * Asset Hot Reload System
 * 
 * Monitors asset files for changes and automatically reloads them
 * without restarting the game or losing state.
 */

import { EventEmitter } from 'events';
import { UnifiedAssetManager, AssetMetadata } from './UnifiedAssetManager';
import { AssetRegistry } from './AssetRegistry';

export interface FileWatcher {
  watch(path: string, callback: (event: string, filename: string) => void): void;
  unwatch(path: string): void;
  close(): void;
}

export interface HotReloadConfig {
  enabled: boolean;
  debounceDelay: number;
  watchPatterns: string[];
  ignorePatterns: string[];
}

export interface HotReloadEvents {
  'hotreload:detected': { path: string; assetId: string };
  'hotreload:started': { assetId: string };
  'hotreload:completed': { assetId: string };
  'hotreload:failed': { assetId: string; error: Error };
}

/**
 * Asset Hot Reload System
 */
export class AssetHotReload extends EventEmitter {
  private assetManager: UnifiedAssetManager;
  private assetRegistry: AssetRegistry;
  private fileWatcher?: FileWatcher;
  private watchedPaths: Map<string, string> = new Map(); // path -> assetId
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map();
  private config: HotReloadConfig;
  private enabled: boolean = false;

  constructor(
    assetManager: UnifiedAssetManager,
    assetRegistry: AssetRegistry,
    config?: Partial<HotReloadConfig>
  ) {
    super();
    this.assetManager = assetManager;
    this.assetRegistry = assetRegistry;
    
    this.config = {
      enabled: true,
      debounceDelay: 200,
      watchPatterns: ['**/*.png', '**/*.jpg', '**/*.svg', '**/*.json', '**/*.gdl'],
      ignorePatterns: ['**/node_modules/**', '**/.*', '**/build/**'],
      ...config
    };
  }

  /**
   * Start hot reload monitoring
   */
  start(): void {
    if (this.enabled || !this.config.enabled) return;

    console.log('Starting asset hot reload...');

    // Create file watcher (platform-specific implementation needed)
    this.fileWatcher = this.createFileWatcher();

    // Watch all registered assets
    const assets = this.assetRegistry.getAll();
    for (const asset of assets) {
      if (asset.source === 'project') {
        this.watchAsset(asset.id, asset.metadata.path);
      }
    }

    // Listen for new assets
    this.assetRegistry.on('registry:asset-added', (event) => {
      if (event.entry.source === 'project') {
        this.watchAsset(event.entry.id, event.entry.metadata.path);
      }
    });

    // Listen for removed assets
    this.assetRegistry.on('registry:asset-removed', (event) => {
      const path = this.findPathForAsset(event.id);
      if (path) {
        this.unwatchAsset(path);
      }
    });

    this.enabled = true;
    console.log('Asset hot reload started');
  }

  /**
   * Stop hot reload monitoring
   */
  stop(): void {
    if (!this.enabled) return;

    console.log('Stopping asset hot reload...');

    // Clear all timers
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();

    // Stop watching files
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = undefined;
    }

    // Clear watched paths
    this.watchedPaths.clear();

    this.enabled = false;
    console.log('Asset hot reload stopped');
  }

  /**
   * Watch an asset for changes
   */
  private watchAsset(assetId: string, path: string): void {
    if (!this.fileWatcher || !this.shouldWatch(path)) return;

    this.watchedPaths.set(path, assetId);

    this.fileWatcher.watch(path, (event, filename) => {
      if (event === 'change') {
        this.handleFileChange(path, assetId);
      }
    });

    console.log(`Watching asset: ${assetId} at ${path}`);
  }

  /**
   * Stop watching an asset
   */
  private unwatchAsset(path: string): void {
    if (!this.fileWatcher) return;

    this.fileWatcher.unwatch(path);
    this.watchedPaths.delete(path);

    // Clear any pending reload
    const timer = this.reloadTimers.get(path);
    if (timer) {
      clearTimeout(timer);
      this.reloadTimers.delete(path);
    }

    console.log(`Stopped watching: ${path}`);
  }

  /**
   * Handle file change event
   */
  private handleFileChange(path: string, assetId: string): void {
    // Emit detection event
    this.emit('hotreload:detected', { path, assetId });

    // Clear existing timer
    const existingTimer = this.reloadTimers.get(path);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Debounce reload
    const timer = setTimeout(() => {
      this.reloadTimers.delete(path);
      this.reloadAsset(assetId);
    }, this.config.debounceDelay);

    this.reloadTimers.set(path, timer);
  }

  /**
   * Reload an asset
   */
  private async reloadAsset(assetId: string): Promise<void> {
    console.log(`Hot reloading asset: ${assetId}`);
    
    // Emit started event
    this.emit('hotreload:started', { assetId });

    try {
      // Get asset entry
      const entry = this.assetRegistry.get(assetId);
      if (!entry) {
        throw new Error(`Asset not found in registry: ${assetId}`);
      }

      // Update metadata if needed (e.g., file size, modification time)
      await this.updateAssetMetadata(entry);

      // Reload through asset manager
      await this.assetManager.reload(assetId);

      // Reload dependents
      await this.reloadDependents(assetId);

      // Emit completed event
      this.emit('hotreload:completed', { assetId });
      
      console.log(`Hot reload completed: ${assetId}`);
    } catch (error) {
      console.error(`Hot reload failed for ${assetId}:`, error);
      
      // Emit failed event
      this.emit('hotreload:failed', { 
        assetId, 
        error: error as Error 
      });
    }
  }

  /**
   * Reload assets that depend on the given asset
   */
  private async reloadDependents(assetId: string): Promise<void> {
    const dependents = this.assetRegistry.getDependents(assetId);
    
    if (dependents.length === 0) return;

    console.log(`Reloading ${dependents.length} dependent assets...`);

    // Reload dependents in parallel
    const reloadPromises = dependents.map(depId => {
      return this.assetManager.reload(depId).catch(error => {
        console.error(`Failed to reload dependent ${depId}:`, error);
      });
    });

    await Promise.all(reloadPromises);
  }

  /**
   * Update asset metadata from file system
   */
  private async updateAssetMetadata(entry: any): Promise<void> {
    // In a real implementation, this would:
    // 1. Read file stats (size, modification time)
    // 2. Calculate checksum
    // 3. Update dimensions for images
    // 4. Update duration for audio
    
    // For now, just update modification time
    entry.lastModified = Date.now();
  }

  /**
   * Check if a path should be watched
   */
  private shouldWatch(path: string): boolean {
    // Check ignore patterns
    for (const pattern of this.config.ignorePatterns) {
      if (this.matchPattern(path, pattern)) {
        return false;
      }
    }

    // Check watch patterns
    for (const pattern of this.config.watchPatterns) {
      if (this.matchPattern(path, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple pattern matching (in real implementation, use minimatch or similar)
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regex = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.');
    
    return new RegExp(`^${regex}$`).test(path);
  }

  /**
   * Find path for an asset ID
   */
  private findPathForAsset(assetId: string): string | undefined {
    for (const [path, id] of this.watchedPaths) {
      if (id === assetId) {
        return path;
      }
    }
    return undefined;
  }

  /**
   * Create platform-specific file watcher
   */
  private createFileWatcher(): FileWatcher {
    // In a real implementation, this would use:
    // - fs.watch on Node.js
    // - File API + polling on browser
    // - VS Code file system watcher in extension
    
    // Mock implementation
    return {
      watch(path: string, callback: (event: string, filename: string) => void): void {
        // Mock watcher
      },
      
      unwatch(path: string): void {
        // Mock unwatch
      },
      
      close(): void {
        // Mock close
      }
    };
  }

  /**
   * Manually trigger reload for an asset
   */
  async reload(assetId: string): Promise<void> {
    await this.reloadAsset(assetId);
  }

  /**
   * Get hot reload statistics
   */
  getStats(): {
    enabled: boolean;
    watchedAssets: number;
    pendingReloads: number;
  } {
    return {
      enabled: this.enabled,
      watchedAssets: this.watchedPaths.size,
      pendingReloads: this.reloadTimers.size
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...config };

    // Restart if enabled state changed
    if (config.enabled !== undefined) {
      if (config.enabled && !this.enabled) {
        this.start();
      } else if (!config.enabled && this.enabled) {
        this.stop();
      }
    }
  }
}