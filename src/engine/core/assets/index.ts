/**
 * Asset Management System
 * 
 * Central export point for all asset management components
 */

export * from './UnifiedAssetManager';
export * from './AssetRegistry';
export * from './AssetHotReload';

import { UnifiedAssetManager } from './UnifiedAssetManager';
import { AssetRegistry } from './AssetRegistry';
import { AssetHotReload } from './AssetHotReload';
import { UnifiedStateStore } from '../state/UnifiedStateStore';

/**
 * Global asset management instances
 */
let globalAssetManager: UnifiedAssetManager | null = null;
let globalAssetRegistry: AssetRegistry | null = null;
let globalHotReload: AssetHotReload | null = null;

/**
 * Initialize the asset management system
 */
export function initializeAssetManagement(stateStore?: UnifiedStateStore): {
  assetManager: UnifiedAssetManager;
  assetRegistry: AssetRegistry;
  hotReload: AssetHotReload;
} {
  if (!globalAssetManager) {
    // Create instances
    globalAssetManager = new UnifiedAssetManager(stateStore);
    globalAssetRegistry = new AssetRegistry();
    globalHotReload = new AssetHotReload(globalAssetManager, globalAssetRegistry);

    // Start hot reload if in development
    if (process.env.NODE_ENV === 'development') {
      globalHotReload.start();
    }

    console.log('Asset management system initialized');
  }

  return {
    assetManager: globalAssetManager!,
    assetRegistry: globalAssetRegistry!,
    hotReload: globalHotReload!
  };
}

/**
 * Get the global asset manager
 */
export function getGlobalAssetManager(): UnifiedAssetManager {
  if (!globalAssetManager) {
    throw new Error('Asset management not initialized. Call initializeAssetManagement() first.');
  }
  return globalAssetManager;
}

/**
 * Get the global asset registry
 */
export function getGlobalAssetRegistry(): AssetRegistry {
  if (!globalAssetRegistry) {
    throw new Error('Asset management not initialized. Call initializeAssetManagement() first.');
  }
  return globalAssetRegistry;
}

/**
 * Get the global hot reload system
 */
export function getGlobalHotReload(): AssetHotReload {
  if (!globalHotReload) {
    throw new Error('Asset management not initialized. Call initializeAssetManagement() first.');
  }
  return globalHotReload;
}

/**
 * Cleanup asset management system
 */
export function cleanupAssetManagement(): void {
  if (globalHotReload) {
    globalHotReload.stop();
    globalHotReload = null;
  }

  if (globalAssetManager) {
    globalAssetManager.clear();
    globalAssetManager = null;
  }

  if (globalAssetRegistry) {
    globalAssetRegistry = null;
  }

  console.log('Asset management system cleaned up');
}