/**
 * State Middleware
 * 
 * Middleware functions that process actions before they reach the reducer.
 * Used for logging, validation, persistence, and other cross-cutting concerns.
 */

import { Action, Middleware } from './UnifiedStateStore';

/**
 * Logging Middleware
 * 
 * Logs all actions and state changes for debugging
 */
export const loggingMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  const timestamp = new Date(action.timestamp).toISOString();
  
  console.group(`%c[${action.source}] ${action.type}`, 'color: #007ACC; font-weight: bold;');
  console.log('%cTimestamp:', 'color: #666;', timestamp);
  console.log('%cPayload:', 'color: #666;', action.payload);
  console.groupEnd();

  // Pass action to next middleware
  next(action);
};

/**
 * Validation Middleware
 * 
 * Validates action payloads to ensure data integrity
 */
export const validationMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  try {
    validateAction(action);
    next(action);
  } catch (error) {
    console.error(`Invalid action: ${action.type}`, error);
    // Optionally, you could dispatch an error action instead
  }
};

function validateAction(action: Action): void {
  switch (action.type) {
    case 'ENTITY_CREATED':
      if (!action.payload?.id || typeof action.payload.id !== 'number') {
        throw new Error('Entity ID must be a number');
      }
      if (!action.payload?.name || typeof action.payload.name !== 'string') {
        throw new Error('Entity name must be a string');
      }
      break;

    case 'COMPONENT_ADDED':
      if (!action.payload?.entityId || typeof action.payload.entityId !== 'number') {
        throw new Error('Entity ID must be a number');
      }
      if (!action.payload?.componentType || typeof action.payload.componentType !== 'string') {
        throw new Error('Component type must be a string');
      }
      break;

    case 'ASSET_ADDED':
      if (!action.payload?.id || typeof action.payload.id !== 'string') {
        throw new Error('Asset ID must be a string');
      }
      if (!action.payload?.type) {
        throw new Error('Asset type is required');
      }
      break;

    // Add more validation rules as needed
  }
}

/**
 * Performance Middleware
 * 
 * Measures action processing time and warns about slow operations
 */
export const performanceMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  const startTime = performance.now();
  
  next(action);
  
  const duration = performance.now() - startTime;
  
  // Warn if action takes more than 16ms (one frame at 60fps)
  if (duration > 16) {
    console.warn(`Slow action: ${action.type} took ${duration.toFixed(2)}ms`);
  }
};

/**
 * Persistence Middleware
 * 
 * Automatically persists state changes to storage
 */
export class PersistenceMiddleware {
  private saveDebounceTimer?: NodeJS.Timeout;
  private readonly saveDelay = 1000; // Save after 1 second of inactivity

  middleware: Middleware = (action: Action, next: (action: Action) => void) => {
    next(action);

    // Don't persist certain transient actions
    const excludedActions = [
      'ENGINE_STATS_UPDATED',
      'CAMERA_MOVED',
      'ZOOM_CHANGED'
    ];

    if (!excludedActions.includes(action.type)) {
      this.scheduleSave();
    }
  };

  private scheduleSave(): void {
    // Clear existing timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    // Schedule new save
    this.saveDebounceTimer = setTimeout(() => {
      this.save();
    }, this.saveDelay);
  }

  private async save(): Promise<void> {
    try {
      // In a real implementation, this would save to localStorage, IndexedDB, or a file
      console.log('Auto-saving state...');
      // await persistenceService.save(store.getState());
    } catch (error) {
      console.error('Failed to auto-save state:', error);
    }
  }
}

/**
 * Undo/Redo Middleware
 * 
 * Tracks actions for undo/redo functionality
 */
export class UndoRedoMiddleware {
  private history: Action[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100;

  middleware: Middleware = (action: Action, next: (action: Action) => void) => {
    // Handle undo/redo actions specially
    if (action.type === 'UNDO') {
      this.undo();
      return;
    }
    
    if (action.type === 'REDO') {
      this.redo();
      return;
    }

    // For other actions, add to history
    if (this.shouldTrack(action)) {
      // Remove any actions after current index
      this.history = this.history.slice(0, this.currentIndex + 1);
      
      // Add new action
      this.history.push(action);
      
      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      } else {
        this.currentIndex++;
      }
    }

    next(action);
  };

  private shouldTrack(action: Action): boolean {
    // Don't track certain actions
    const excludedActions = [
      'ENGINE_STATS_UPDATED',
      'ASSET_LOADING',
      'UNDO',
      'REDO'
    ];
    
    return !excludedActions.includes(action.type);
  }

  private undo(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const action = this.history[this.currentIndex];
      // TODO: Create reverse action and dispatch it
      console.log('Undo:', action.type);
    }
  }

  private redo(): void {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const action = this.history[this.currentIndex];
      // TODO: Re-dispatch the action
      console.log('Redo:', action.type);
    }
  }

  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }
}

/**
 * Batch Action Middleware
 * 
 * Allows dispatching multiple actions as a single batch
 */
export const batchMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  if (action.type === 'BATCH_ACTIONS' && Array.isArray(action.payload)) {
    // Convert to BATCH_UPDATE action that the reducer understands
    next({
      ...action,
      type: 'BATCH_UPDATE',
      payload: action.payload.map((subAction: any) => ({
        ...subAction,
        source: action.source,
        timestamp: action.timestamp
      }))
    });
  } else {
    next(action);
  }
};

/**
 * Throttle Middleware
 * 
 * Throttles certain high-frequency actions
 */
export class ThrottleMiddleware {
  private throttleTimers: Map<string, NodeJS.Timeout> = new Map();
  private throttleDelays: Map<string, number> = new Map([
    ['CAMERA_MOVED', 50],
    ['ZOOM_CHANGED', 50],
    ['ENGINE_STATS_UPDATED', 100]
  ]);

  middleware: Middleware = (action: Action, next: (action: Action) => void) => {
    const delay = this.throttleDelays.get(action.type);
    
    if (delay) {
      // Check if already throttled
      if (this.throttleTimers.has(action.type)) {
        return; // Skip this action
      }

      // Set throttle timer
      this.throttleTimers.set(action.type, setTimeout(() => {
        this.throttleTimers.delete(action.type);
      }, delay));
    }

    next(action);
  };
}

/**
 * Analytics Middleware
 * 
 * Tracks actions for analytics and telemetry
 */
export const analyticsMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  // Track important user actions
  const trackedActions = [
    'ENTITY_CREATED',
    'ENTITY_DELETED',
    'SCENE_CREATED',
    'ASSET_ADDED',
    'PROJECT_SAVED',
    'GAME_EXPORTED'
  ];

  if (trackedActions.includes(action.type)) {
    // In a real implementation, this would send to analytics service
    console.log('Analytics:', {
      event: action.type,
      properties: {
        source: action.source,
        timestamp: action.timestamp,
        ...action.payload
      }
    });
  }

  next(action);
};

/**
 * Error Handling Middleware
 * 
 * Catches and handles errors in the action processing pipeline
 */
export const errorHandlingMiddleware: Middleware = (action: Action, next: (action: Action) => void) => {
  try {
    next(action);
  } catch (error) {
    console.error(`Error processing action ${action.type}:`, error);
    
    // Dispatch error action
    next({
      type: 'ERROR_OCCURRED',
      payload: {
        originalAction: action,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      },
      source: action.source,
      timestamp: Date.now()
    });
  }
};

/**
 * Create default middleware stack
 */
export function createDefaultMiddleware(): Middleware[] {
  const persistenceMiddleware = new PersistenceMiddleware();
  const undoRedoMiddleware = new UndoRedoMiddleware();
  const throttleMiddleware = new ThrottleMiddleware();

  return [
    errorHandlingMiddleware,
    loggingMiddleware,
    performanceMiddleware,
    validationMiddleware,
    throttleMiddleware.middleware,
    batchMiddleware,
    undoRedoMiddleware.middleware,
    persistenceMiddleware.middleware,
    analyticsMiddleware
  ];
}