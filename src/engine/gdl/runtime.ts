import { GameEngine } from '../core/GameEngine';
import { globalEventBus } from '../core/events/EventBus';

/**
 * GDL Runtime executes Game Description Language code
 * Provides hot-reload and error recovery capabilities
 */
export class GDLRuntime {
  private engine: GameEngine;
  private currentCode: string = '';
  private isRunning: boolean = false;

  constructor(engine: GameEngine) {
    this.engine = engine;
    
    this.setupEventListeners();
  }

  /**
   * Execute GDL code with error handling
   */
  async execute(gdlCode: string): Promise<ExecutionResult> {
    if (this.isRunning) {
      return {
        success: false,
        error: 'Another execution is in progress'
      };
    }

    this.isRunning = true;
    const startTime = performance.now();

    try {
      // Store current code for hot-reload
      this.currentCode = gdlCode;

      // Clear previous entities if doing a full reload
      if (this.shouldClearEntities(gdlCode)) {
        this.clearGameState();
      }

      // TODO: Execute GDL code directly through compiler
      // For now, this is a placeholder for direct execution
      console.log('Executing GDL code:', gdlCode);

      const executionTime = performance.now() - startTime;
      
      return {
        success: true,
        executionTime,
        message: `GDL code executed successfully in ${executionTime.toFixed(2)}ms`
      };

    } catch (error) {
      console.error('GDL Runtime error:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        suggestions: this.generateErrorSuggestions(error instanceof Error ? error : new Error(String(error)))
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Hot-reload GDL code changes
   */
  async hotReload(gdlCode: string): Promise<ExecutionResult> {
    try {
      // Detect what changed
      const changes = this.detectChanges(this.currentCode, gdlCode);
      
      if (changes.fullReload) {
        return this.execute(gdlCode);
      }

      // Apply incremental changes
      for (const change of changes.modifications) {
        await this.applyChange(change);
      }

      this.currentCode = gdlCode;
      
      return {
        success: true,
        message: 'Hot-reload successful',
        changes: changes.modifications.length
      };

    } catch (error) {
      return {
        success: false,
        error: `Hot-reload failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Detect changes between old and new GDL code
   */
  private detectChanges(oldCode: string, newCode: string): ChangeSet {
    // Simple implementation - can be enhanced with proper diffing
    if (!oldCode || oldCode.trim() === '') {
      return { fullReload: true, modifications: [] };
    }

    // For now, do full reload
    // TODO: Implement incremental change detection
    return { fullReload: true, modifications: [] };
  }

  /**
   * Apply a single change incrementally
   */
  private async applyChange(change: Change): Promise<void> {
    switch (change.type) {
      case 'ADD_ENTITY':
        // Add new entity without clearing others
        break;
      
      case 'MODIFY_ENTITY':
        // Update existing entity
        break;
      
      case 'REMOVE_ENTITY':
        // Remove specific entity
        break;
    }
  }

  /**
   * Check if we should clear entities before execution
   */
  private shouldClearEntities(gdlCode: string): boolean {
    // Always clear entities when executing new code
    // This ensures clean level loading
    return true;
  }

  /**
   * Clear current game state
   */
  private clearGameState(): void {
    console.log('GDLRuntime: Clearing game state');
    
    // Clear all entities except system entities
    const entityManager = this.engine.getEntityManager();
    const entities = entityManager.getAll();
    
    entities.forEach(entity => {
      // Keep camera and other system entities - for now, clear all entities
      entityManager.destroy(entity.id);
    });

    // TODO: Clear entities from compiler context if needed
    
    console.log('GDLRuntime: Game state cleared');
  }

  /**
   * Force clear all entities (for level editor)
   */
  public clearAllEntities(): void {
    this.clearGameState();
  }

  /**
   * Generate helpful error suggestions
   */
  private generateErrorSuggestions(error: Error): string[] {
    const suggestions: string[] = [];
    const errorMsg = error.message.toLowerCase();

    if (errorMsg.includes('entity') && errorMsg.includes('not found')) {
      suggestions.push('Make sure the entity is created before referencing it');
      suggestions.push('Check the entity name spelling');
    }

    if (errorMsg.includes('behavior')) {
      suggestions.push('Available behaviors: PlatformerMovement, PatrolBehavior, ChaseBehavior');
      suggestions.push('Check behavior name spelling and capitalization');
    }

    if (errorMsg.includes('syntax')) {
      suggestions.push('Check for missing brackets or quotes');
      suggestions.push('Ensure proper GDL syntax');
    }

    return suggestions;
  }

  /**
   * Setup event listeners for runtime events
   */
  private setupEventListeners(): void {
    globalEventBus.on('gdl:error', (data) => {
      console.error('GDL Error:', data);
    });

    globalEventBus.on('gdl:executed', (data) => {
      console.log('GDL Executed:', data);
    });
  }

  /**
   * Get current GDL code
   */
  getCurrentCode(): string {
    return this.currentCode;
  }

  /**
   * Check if runtime is executing
   */
  isExecuting(): boolean {
    return this.isRunning;
  }
}

interface ExecutionResult {
  success: boolean;
  error?: string;
  message?: string;
  executionTime?: number;
  changes?: number;
  suggestions?: string[];
}

interface ChangeSet {
  fullReload: boolean;
  modifications: Change[];
}

interface Change {
  type: 'ADD_ENTITY' | 'MODIFY_ENTITY' | 'REMOVE_ENTITY';
  entityName?: string;
  data?: any;
}