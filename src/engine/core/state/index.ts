/**
 * State Management System
 * 
 * Central export point for all state management components
 */

export * from './UnifiedStateStore';
export * from './StateBridge';
export * from './StateMiddleware';

import { UnifiedStateStore } from './UnifiedStateStore';
import { StateBridgeManager } from './StateBridge';
import { createDefaultMiddleware } from './StateMiddleware';
import { GameEngine } from '../GameEngine';

/**
 * Global state store instance
 */
let globalStore: UnifiedStateStore | null = null;
let globalBridgeManager: StateBridgeManager | null = null;

/**
 * Initialize the global state management system
 */
export function initializeStateManagement(engine?: GameEngine): {
  store: UnifiedStateStore;
  bridgeManager: StateBridgeManager;
} {
  if (!globalStore) {
    // Create store
    globalStore = new UnifiedStateStore();

    // Add middleware
    const middleware = createDefaultMiddleware();
    middleware.forEach(m => globalStore!.use(m));

    // Create bridge manager
    globalBridgeManager = StateBridgeManager.createStandardBridges(globalStore, engine);

    // Connect all bridges
    globalBridgeManager.connectAll();

    console.log('State management system initialized');
  }

  return {
    store: globalStore,
    bridgeManager: globalBridgeManager!
  };
}

/**
 * Get the global state store
 */
export function getGlobalStore(): UnifiedStateStore {
  if (!globalStore) {
    throw new Error('State management not initialized. Call initializeStateManagement() first.');
  }
  return globalStore;
}

/**
 * Get the global bridge manager
 */
export function getGlobalBridgeManager(): StateBridgeManager {
  if (!globalBridgeManager) {
    throw new Error('State management not initialized. Call initializeStateManagement() first.');
  }
  return globalBridgeManager;
}

/**
 * Cleanup state management system
 */
export function cleanupStateManagement(): void {
  if (globalBridgeManager) {
    globalBridgeManager.disconnectAll();
    globalBridgeManager = null;
  }
  
  if (globalStore) {
    globalStore.persist(); // Save state before cleanup
    globalStore = null;
  }

  console.log('State management system cleaned up');
}