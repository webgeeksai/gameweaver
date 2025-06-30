/**
 * Unified Asset Manager
 * 
 * Centralized asset management system that handles loading, caching,
 * and distribution of all game assets across all components.
 */

import { EventEmitter } from 'events';
import { UnifiedStateStore, AssetState } from '../state/UnifiedStateStore';

// Import AssetType from core types
import { AssetType } from '../types';

export interface AssetMetadata {
  name: string;
  type: AssetType;
  path: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  format?: string;
  dependencies?: string[];
  tags?: string[];
  [key: string]: any;
}

export interface Asset {
  id: string;
  metadata: AssetMetadata;
  data: any;
  loaded: boolean;
  loading: boolean;
  error?: Error;
  references: number;
  lastAccessed: number;
}

export interface AssetLoader {
  type: AssetType;
  extensions: string[];
  load(path: string, metadata: AssetMetadata): Promise<any>;
  unload?(asset: Asset): void;
}

export interface AssetHandle {
  id: string;
  get(): any;
  release(): void;
  isLoaded(): boolean;
  onLoad(callback: (data: any) => void): void;
  onError(callback: (error: Error) => void): void;
}

// Asset events
export interface AssetEvents {
  'asset:loading': { id: string; metadata: AssetMetadata };
  'asset:loaded': { id: string; data: any };
  'asset:error': { id: string; error: Error };
  'asset:unloaded': { id: string };
  'asset:updated': { id: string; data: any };
}

/**
 * Unified Asset Manager
 * 
 * Features:
 * - Centralized asset loading and caching
 * - Reference counting for memory management
 * - Hot reload support
 * - Dependency tracking
 * - Multiple loader support
 * - LRU cache with size limits
 */
export class UnifiedAssetManager extends EventEmitter {
  private assets: Map<string, Asset> = new Map();
  private loaders: Map<AssetType, AssetLoader> = new Map();
  private loadingQueue: Set<string> = new Set();
  private stateStore?: UnifiedStateStore;
  
  // Configuration
  private maxCacheSize: number = 100 * 1024 * 1024; // 100MB
  private currentCacheSize: number = 0;
  private autoUnloadThreshold: number = 0.9; // Unload when 90% full

  constructor(stateStore?: UnifiedStateStore) {
    super();
    this.stateStore = stateStore;
    this.registerDefaultLoaders();
  }

  /**
   * Register default asset loaders
   */
  private registerDefaultLoaders(): void {
    // Sprite loader
    this.registerLoader({
      type: AssetType.Sprite,
      extensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
      load: async (path: string) => {
        if (typeof window !== 'undefined' && 'Image' in window) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error(`Failed to load image: ${path}`));
            img.src = path;
          });
        } else {
          // Node.js environment - return path for now
          return path;
        }
      }
    });

    // Sound loader
    this.registerLoader({
      type: AssetType.Sound,
      extensions: ['.mp3', '.wav', '.ogg', '.m4a', '.webm'],
      load: async (path: string) => {
        if (typeof window !== 'undefined' && 'Audio' in window) {
          return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.onloadeddata = () => resolve(audio);
            audio.onerror = (e) => reject(new Error(`Failed to load audio: ${path}`));
            audio.src = path;
          });
        } else {
          // Node.js environment - return path for now
          return path;
        }
      }
    });

    // JSON data loader
    this.registerLoader({
      type: AssetType.Data,
      extensions: ['.json'],
      load: async (path: string) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load JSON: ${response.statusText}`);
        }
        return response.json();
      }
    });

    // Level loader (GDL files)
    this.registerLoader({
      type: AssetType.Level,
      extensions: ['.gdl'],
      load: async (path: string) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load level: ${response.statusText}`);
        }
        return response.text();
      }
    });

    // Prefab loader
    this.registerLoader({
      type: AssetType.Prefab,
      extensions: ['.prefab', '.json'],
      load: async (path: string) => {
        const response = await fetch(path);
        if (!response.ok) {
          throw new Error(`Failed to load prefab: ${response.statusText}`);
        }
        return response.json();
      }
    });
  }

  /**
   * Register a custom asset loader
   */
  registerLoader(loader: AssetLoader): void {
    this.loaders.set(loader.type, loader);
    console.log(`Registered loader for type: ${loader.type}`);
  }

  /**
   * Load an asset
   */
  async load(id: string, metadata: AssetMetadata): Promise<AssetHandle> {
    // Check if already loaded
    const existing = this.assets.get(id);
    if (existing && existing.loaded) {
      existing.references++;
      existing.lastAccessed = Date.now();
      return this.createHandle(id);
    }

    // Check if already loading
    if (this.loadingQueue.has(id)) {
      return this.createHandle(id);
    }

    // Start loading
    this.loadingQueue.add(id);

    const asset: Asset = {
      id,
      metadata,
      data: null,
      loaded: false,
      loading: true,
      references: 1,
      lastAccessed: Date.now()
    };

    this.assets.set(id, asset);

    // Emit loading event
    this.emit('asset:loading', { id, metadata });

    // Update state store
    if (this.stateStore) {
      this.stateStore.dispatch({
        type: 'ASSET_ADDED',
        payload: {
          id,
          name: metadata.name,
          type: metadata.type,
          path: metadata.path,
          metadata,
          loaded: false,
          loading: true
        },
        source: 'engine',
        timestamp: Date.now()
      });
    }

    try {
      // Find appropriate loader
      const loader = this.loaders.get(metadata.type);
      if (!loader) {
        throw new Error(`No loader registered for type: ${metadata.type}`);
      }

      // Load the asset
      const data = await loader.load(metadata.path, metadata);
      
      // Update asset
      asset.data = data;
      asset.loaded = true;
      asset.loading = false;
      
      // Update cache size
      if (metadata.size) {
        this.currentCacheSize += metadata.size;
        this.checkCacheSize();
      }

      // Emit loaded event
      this.emit('asset:loaded', { id, data });

      // Update state store
      if (this.stateStore) {
        this.stateStore.dispatch({
          type: 'ASSET_LOADED',
          payload: { id, data },
          source: 'engine',
          timestamp: Date.now()
        });
      }

      console.log(`Asset loaded: ${id}`);
    } catch (error) {
      // Handle error
      asset.error = error as Error;
      asset.loading = false;
      
      // Emit error event
      this.emit('asset:error', { id, error: error as Error });

      // Update state store
      if (this.stateStore) {
        this.stateStore.dispatch({
          type: 'ASSET_UPDATED',
          payload: {
            id,
            changes: {
              loaded: false,
              loading: false,
              error: (error as Error).message
            }
          },
          source: 'engine',
          timestamp: Date.now()
        });
      }

      console.error(`Failed to load asset ${id}:`, error);
      throw error;
    } finally {
      this.loadingQueue.delete(id);
    }

    return this.createHandle(id);
  }

  /**
   * Get an asset
   */
  get(id: string): Asset | undefined {
    const asset = this.assets.get(id);
    if (asset) {
      asset.lastAccessed = Date.now();
    }
    return asset;
  }

  /**
   * Get asset data
   */
  getData(id: string): any {
    const asset = this.get(id);
    return asset?.data;
  }

  /**
   * Check if asset is loaded
   */
  isLoaded(id: string): boolean {
    const asset = this.assets.get(id);
    return asset?.loaded || false;
  }

  /**
   * Unload an asset
   */
  unload(id: string): void {
    const asset = this.assets.get(id);
    if (!asset) return;

    // Check references
    if (asset.references > 0) {
      console.warn(`Cannot unload asset ${id}: still has ${asset.references} references`);
      return;
    }

    // Call unload handler if available
    const loader = this.loaders.get(asset.metadata.type);
    if (loader?.unload) {
      loader.unload(asset);
    }

    // Update cache size
    if (asset.metadata.size) {
      this.currentCacheSize -= asset.metadata.size;
    }

    // Remove from cache
    this.assets.delete(id);

    // Emit unloaded event
    this.emit('asset:unloaded', { id });

    // Update state store
    if (this.stateStore) {
      this.stateStore.dispatch({
        type: 'ASSET_DELETED',
        payload: { id },
        source: 'engine',
        timestamp: Date.now()
      });
    }

    console.log(`Asset unloaded: ${id}`);
  }

  /**
   * Create an asset handle
   */
  private createHandle(id: string): AssetHandle {
    const manager = this;

    return {
      id,
      
      get(): any {
        const asset = manager.get(id);
        return asset?.data;
      },

      release(): void {
        const asset = manager.assets.get(id);
        if (asset) {
          asset.references--;
          if (asset.references <= 0 && !asset.loading) {
            // Eligible for unloading
            manager.checkForUnload(id);
          }
        }
      },

      isLoaded(): boolean {
        return manager.isLoaded(id);
      },

      onLoad(callback: (data: any) => void): void {
        const asset = manager.assets.get(id);
        if (asset?.loaded) {
          callback(asset.data);
        } else {
          manager.once('asset:loaded', (event) => {
            if (event.id === id) {
              callback(event.data);
            }
          });
        }
      },

      onError(callback: (error: Error) => void): void {
        const asset = manager.assets.get(id);
        if (asset?.error) {
          callback(asset.error);
        } else {
          manager.once('asset:error', (event) => {
            if (event.id === id) {
              callback(event.error);
            }
          });
        }
      }
    };
  }

  /**
   * Check if asset should be unloaded
   */
  private checkForUnload(id: string): void {
    const asset = this.assets.get(id);
    if (!asset || asset.references > 0) return;

    // Don't unload recently accessed assets
    const timeSinceAccess = Date.now() - asset.lastAccessed;
    const minRetentionTime = 60000; // 1 minute

    if (timeSinceAccess > minRetentionTime) {
      this.unload(id);
    }
  }

  /**
   * Check cache size and unload if necessary
   */
  private checkCacheSize(): void {
    if (this.currentCacheSize < this.maxCacheSize * this.autoUnloadThreshold) {
      return;
    }

    console.log(`Cache size ${this.currentCacheSize} exceeds threshold, unloading unused assets`);

    // Sort assets by last accessed time
    const sortedAssets = Array.from(this.assets.values())
      .filter(a => a.references === 0 && a.loaded)
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    // Unload oldest assets until under threshold
    for (const asset of sortedAssets) {
      this.unload(asset.id);
      
      if (this.currentCacheSize < this.maxCacheSize * 0.7) {
        break;
      }
    }
  }

  /**
   * Reload an asset (for hot reload)
   */
  async reload(id: string): Promise<void> {
    const asset = this.assets.get(id);
    if (!asset) {
      throw new Error(`Asset not found: ${id}`);
    }

    console.log(`Reloading asset: ${id}`);

    // Keep references
    const refs = asset.references;
    
    try {
      // Reload the asset
      const loader = this.loaders.get(asset.metadata.type);
      if (!loader) {
        throw new Error(`No loader for type: ${asset.metadata.type}`);
      }

      const newData = await loader.load(asset.metadata.path, asset.metadata);
      
      // Update asset data
      asset.data = newData;
      asset.error = undefined;

      // Emit updated event
      this.emit('asset:updated', { id, data: newData });

      // Update state store
      if (this.stateStore) {
        this.stateStore.dispatch({
          type: 'ASSET_UPDATED',
          payload: {
            id,
            changes: { loaded: true, error: undefined }
          },
          source: 'engine',
          timestamp: Date.now()
        });
      }

      console.log(`Asset reloaded: ${id}`);
    } catch (error) {
      console.error(`Failed to reload asset ${id}:`, error);
      throw error;
    }
  }

  /**
   * Load multiple assets
   */
  async loadBatch(assets: Array<{ id: string; metadata: AssetMetadata }>): Promise<AssetHandle[]> {
    const handles = await Promise.all(
      assets.map(({ id, metadata }) => this.load(id, metadata))
    );
    return handles;
  }

  /**
   * Preload assets by type or tag
   */
  async preload(filter: { type?: AssetType; tags?: string[] }): Promise<void> {
    const toLoad: Array<{ id: string; metadata: AssetMetadata }> = [];

    // In a real implementation, this would query available assets
    // For now, this is a placeholder
    console.log('Preloading assets:', filter);
  }

  /**
   * Get asset statistics
   */
  getStats(): {
    totalAssets: number;
    loadedAssets: number;
    loadingAssets: number;
    cacheSize: number;
    maxCacheSize: number;
  } {
    let loadedCount = 0;
    let loadingCount = 0;

    for (const asset of this.assets.values()) {
      if (asset.loaded) loadedCount++;
      if (asset.loading) loadingCount++;
    }

    return {
      totalAssets: this.assets.size,
      loadedAssets: loadedCount,
      loadingAssets: loadingCount,
      cacheSize: this.currentCacheSize,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Clear all assets
   */
  clear(): void {
    // Unload all assets
    for (const [id, asset] of this.assets) {
      if (asset.references === 0) {
        this.unload(id);
      }
    }
  }

  /**
   * Get assets by type
   */
  getAssetsByType(type: AssetType): Asset[] {
    return Array.from(this.assets.values()).filter(a => a.metadata.type === type);
  }

  /**
   * Get assets by tag
   */
  getAssetsByTag(tag: string): Asset[] {
    return Array.from(this.assets.values()).filter(
      a => a.metadata.tags?.includes(tag)
    );
  }

  /**
   * Search assets
   */
  searchAssets(query: string): Asset[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.assets.values()).filter(
      a => a.metadata.name.toLowerCase().includes(lowerQuery) ||
           a.metadata.tags?.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }
}