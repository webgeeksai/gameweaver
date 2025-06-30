/**
 * Undo/Redo System
 * 
 * Provides comprehensive undo/redo functionality for all engine operations
 * using the Command pattern with state snapshots.
 */

import { EventEmitter } from 'events';
import { UnifiedStateStore, Action } from '../state/UnifiedStateStore';

export interface Command {
  id: string;
  name: string;
  timestamp: number;
  execute(): void | Promise<void>;
  undo(): void | Promise<void>;
  redo?(): void | Promise<void>;
  canUndo?(): boolean;
  canRedo?(): boolean;
  merge?(other: Command): boolean;
}

export interface CommandGroup {
  id: string;
  name: string;
  commands: Command[];
  timestamp: number;
}

export interface UndoRedoState {
  canUndo: boolean;
  canRedo: boolean;
  undoStackSize: number;
  redoStackSize: number;
  currentCommand?: string;
  lastCommand?: string;
}

export interface UndoRedoConfig {
  maxStackSize: number;
  enableMerging: boolean;
  mergeDelay: number;
  enableSnapshots: boolean;
  snapshotInterval: number;
}

export interface StateSnapshot {
  id: string;
  timestamp: number;
  state: any;
  commandIndex: number;
}

/**
 * Base command class
 */
export abstract class BaseCommand implements Command {
  id: string;
  name: string;
  timestamp: number;

  constructor(name: string) {
    this.id = this.generateId();
    this.name = name;
    this.timestamp = Date.now();
  }

  abstract execute(): void | Promise<void>;
  abstract undo(): void | Promise<void>;

  redo(): void | Promise<void> {
    return this.execute();
  }

  canUndo(): boolean {
    return true;
  }

  canRedo(): boolean {
    return true;
  }

  merge(other: Command): boolean {
    return false;
  }

  private generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * State-based command for store actions
 */
export class StateCommand extends BaseCommand {
  private stateStore: UnifiedStateStore;
  private action: Action;
  private previousState?: any;
  private nextState?: any;

  constructor(
    name: string,
    stateStore: UnifiedStateStore,
    action: Action
  ) {
    super(name);
    this.stateStore = stateStore;
    this.action = action;
  }

  async execute(): Promise<void> {
    // Capture previous state
    this.previousState = this.captureState();
    
    // Execute action
    this.stateStore.dispatch(this.action);
    
    // Capture next state
    this.nextState = this.captureState();
  }

  async undo(): Promise<void> {
    if (!this.previousState) {
      throw new Error('No previous state captured');
    }

    // Restore previous state
    this.restoreState(this.previousState);
  }

  async redo(): Promise<void> {
    if (!this.nextState) {
      throw new Error('No next state captured');
    }

    // Restore next state
    this.restoreState(this.nextState);
  }

  private captureState(): any {
    const state = this.stateStore.getState();
    // Deep clone relevant parts of state
    return {
      entities: this.cloneMap(state.entities),
      scenes: this.cloneMap(state.scenes),
      assets: this.cloneMap(state.assets),
      editors: { ...state.editors }
    };
  }

  private restoreState(snapshot: any): void {
    // Dispatch restore action
    this.stateStore.dispatch({
      type: 'STATE_RESTORED',
      payload: snapshot,
      source: 'undo-redo',
      timestamp: Date.now()
    });
  }

  private cloneMap(map: Map<any, any>): Map<any, any> {
    return new Map(
      Array.from(map.entries()).map(([k, v]) => [k, { ...v }])
    );
  }
}

/**
 * Composite command for grouping
 */
export class CompositeCommand extends BaseCommand {
  private commands: Command[] = [];

  constructor(name: string, commands?: Command[]) {
    super(name);
    this.commands = commands || [];
  }

  addCommand(command: Command): void {
    this.commands.push(command);
  }

  async execute(): Promise<void> {
    for (const command of this.commands) {
      await command.execute();
    }
  }

  async undo(): Promise<void> {
    // Undo in reverse order
    for (let i = this.commands.length - 1; i >= 0; i--) {
      await this.commands[i].undo();
    }
  }

  async redo(): Promise<void> {
    for (const command of this.commands) {
      await command.redo?.() || command.execute();
    }
  }

  canUndo(): boolean {
    return this.commands.every(cmd => cmd.canUndo?.() ?? true);
  }

  canRedo(): boolean {
    return this.commands.every(cmd => cmd.canRedo?.() ?? true);
  }
}

/**
 * Undo/Redo System Manager
 */
export class UndoRedoSystem extends EventEmitter {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private snapshots: StateSnapshot[] = [];
  private config: UndoRedoConfig;
  private isExecuting: boolean = false;
  private lastSnapshotTime: number = 0;
  private mergeTimer?: NodeJS.Timeout;
  private stateStore?: UnifiedStateStore;

  constructor(config?: Partial<UndoRedoConfig>, stateStore?: UnifiedStateStore) {
    super();
    
    this.config = {
      maxStackSize: 100,
      enableMerging: true,
      mergeDelay: 300,
      enableSnapshots: true,
      snapshotInterval: 10,
      ...config
    };

    this.stateStore = stateStore;
  }

  /**
   * Execute a command
   */
  async execute(command: Command): Promise<void> {
    if (this.isExecuting) {
      throw new Error('Command execution in progress');
    }

    this.isExecuting = true;

    try {
      // Execute command
      await command.execute();

      // Add to undo stack
      this.addToUndoStack(command);

      // Clear redo stack
      this.redoStack = [];

      // Check for snapshot
      this.checkSnapshot();

      // Emit state change
      this.emitStateChange();

      // Handle merging
      if (this.config.enableMerging) {
        this.scheduleMergeCheck();
      }

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undo last command
   */
  async undo(): Promise<void> {
    if (this.isExecuting) {
      throw new Error('Command execution in progress');
    }

    if (!this.canUndo()) {
      throw new Error('Nothing to undo');
    }

    this.isExecuting = true;

    try {
      const command = this.undoStack.pop()!;
      
      // Undo command
      await command.undo();

      // Add to redo stack
      this.redoStack.push(command);

      // Emit state change
      this.emitStateChange();

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redo last undone command
   */
  async redo(): Promise<void> {
    if (this.isExecuting) {
      throw new Error('Command execution in progress');
    }

    if (!this.canRedo()) {
      throw new Error('Nothing to redo');
    }

    this.isExecuting = true;

    try {
      const command = this.redoStack.pop()!;
      
      // Redo command
      if (command.redo) {
        await command.redo();
      } else {
        await command.execute();
      }

      // Add back to undo stack
      this.undoStack.push(command);

      // Emit state change
      this.emitStateChange();

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Begin command group
   */
  beginGroup(name: string): CompositeCommand {
    const group = new CompositeCommand(name);
    return group;
  }

  /**
   * End command group
   */
  async endGroup(group: CompositeCommand): Promise<void> {
    if (group instanceof CompositeCommand) {
      await this.execute(group);
    }
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get undo/redo state
   */
  getState(): UndoRedoState {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      currentCommand: this.undoStack[this.undoStack.length - 1]?.name,
      lastCommand: this.undoStack[this.undoStack.length - 2]?.name
    };
  }

  /**
   * Clear history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.snapshots = [];
    this.emitStateChange();
  }

  /**
   * Get command history
   */
  getHistory(): Command[] {
    return [...this.undoStack];
  }

  /**
   * Get redo history
   */
  getRedoHistory(): Command[] {
    return [...this.redoStack];
  }

  /**
   * Create command from store action
   */
  createStateCommand(name: string, action: Action): StateCommand {
    if (!this.stateStore) {
      throw new Error('State store not configured');
    }
    
    return new StateCommand(name, this.stateStore, action);
  }

  /**
   * Add to undo stack
   */
  private addToUndoStack(command: Command): void {
    // Check stack size limit
    if (this.undoStack.length >= this.config.maxStackSize) {
      // Remove oldest commands
      const removeCount = Math.floor(this.config.maxStackSize * 0.2);
      this.undoStack.splice(0, removeCount);
      
      // Remove associated snapshots
      this.snapshots = this.snapshots.filter(
        snap => snap.commandIndex >= removeCount
      );
    }

    this.undoStack.push(command);
  }

  /**
   * Check if snapshot needed
   */
  private checkSnapshot(): void {
    if (!this.config.enableSnapshots || !this.stateStore) return;

    const commandCount = this.undoStack.length;
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const lastSnapshotIndex = lastSnapshot?.commandIndex || 0;

    if (commandCount - lastSnapshotIndex >= this.config.snapshotInterval) {
      this.createSnapshot();
    }
  }

  /**
   * Create state snapshot
   */
  private createSnapshot(): void {
    if (!this.stateStore) return;

    const snapshot: StateSnapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      state: this.captureFullState(),
      commandIndex: this.undoStack.length
    };

    this.snapshots.push(snapshot);

    // Limit snapshots
    if (this.snapshots.length > 10) {
      this.snapshots.shift();
    }
  }

  /**
   * Capture full state
   */
  private captureFullState(): any {
    if (!this.stateStore) return null;
    
    const state = this.stateStore.getState();
    // Deep clone entire state
    return JSON.parse(JSON.stringify(state));
  }

  /**
   * Schedule merge check
   */
  private scheduleMergeCheck(): void {
    if (this.mergeTimer) {
      clearTimeout(this.mergeTimer);
    }

    this.mergeTimer = setTimeout(() => {
      this.checkMerge();
    }, this.config.mergeDelay);
  }

  /**
   * Check for command merging
   */
  private checkMerge(): void {
    if (this.undoStack.length < 2) return;

    const lastCommand = this.undoStack[this.undoStack.length - 1];
    const prevCommand = this.undoStack[this.undoStack.length - 2];

    // Check if commands can be merged
    if (prevCommand.merge && prevCommand.merge(lastCommand)) {
      // Remove last command as it was merged
      this.undoStack.pop();
      this.emitStateChange();
    }
  }

  /**
   * Emit state change
   */
  private emitStateChange(): void {
    this.emit('stateChanged', this.getState());
  }

  /**
   * Restore from snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot || !this.stateStore) {
      throw new Error('Snapshot not found');
    }

    // Restore state
    this.stateStore.dispatch({
      type: 'STATE_RESTORED',
      payload: snapshot.state,
      source: 'undo-redo',
      timestamp: Date.now()
    });

    // Adjust stacks
    this.undoStack = this.undoStack.slice(0, snapshot.commandIndex);
    this.redoStack = [];

    this.emitStateChange();
  }

  /**
   * Get snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Export history
   */
  exportHistory(): string {
    return JSON.stringify({
      undoStack: this.undoStack.map(cmd => ({
        id: cmd.id,
        name: cmd.name,
        timestamp: cmd.timestamp
      })),
      snapshots: this.snapshots,
      config: this.config
    }, null, 2);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCommands: number;
    undoStackSize: number;
    redoStackSize: number;
    snapshotCount: number;
    memoryUsage: number;
  } {
    const stats = {
      totalCommands: this.undoStack.length + this.redoStack.length,
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      snapshotCount: this.snapshots.length,
      memoryUsage: 0
    };

    // Estimate memory usage
    if (this.snapshots.length > 0) {
      const sampleSnapshot = JSON.stringify(this.snapshots[0].state);
      stats.memoryUsage = sampleSnapshot.length * this.snapshots.length;
    }

    return stats;
  }
}