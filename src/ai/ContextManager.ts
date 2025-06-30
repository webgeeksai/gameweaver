/**
 * Context Manager for the Game Vibe Engine
 * Maintains game state and conversation context for AI interactions
 */

import { EntityReference, GameContext, GameType, GamePhase, ConversationTurn } from './types';
import { Vector2 } from '../core/math/Vector2';

export class ContextManager {
  private context: GameContext;
  private historySize: number = 50;
  
  constructor() {
    this.context = this.createInitialContext();
  }
  
  /**
   * Create the initial empty context
   */
  private createInitialContext(): GameContext {
    return {
      // Entity tracking
      entities: new Map(),
      lastCreatedEntity: null,
      playerEntity: null,
      
      // Game understanding
      gameType: null,
      currentScene: null,
      gamePhase: GamePhase.Initial,
      
      // Conversation state
      conversationHistory: [],
      lastCommand: null,
      lastSuccess: true,
      
      // User preferences
      preferredStyle: 'natural',
      skillLevel: 'beginner',
      
      // Scene tracking
      scenes: new Map(),
      
      // Temporal context
      sessionStartTime: Date.now(),
      lastActivityTime: Date.now(),
      commandCount: 0
    };
  }
  
  /**
   * Get the current context
   */
  getContext(): GameContext {
    return this.context;
  }
  
  /**
   * Update context after a command is executed
   */
  updateContext(command: any, result: any): void {
    // Update last activity time
    this.context.lastActivityTime = Date.now();
    this.context.commandCount++;
    
    // Track created entities
    if (command.type === 'CREATE_ENTITY' && result.success) {
      const entityRef: EntityReference = {
        id: result.entityId || `entity_${Date.now()}`,
        name: command.parameters.name || command.parameters.entityType,
        type: command.parameters.entityType,
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      
      this.context.entities.set(entityRef.name, entityRef);
      this.context.lastCreatedEntity = entityRef;
      
      // Detect player entity
      if (this.isPlayerEntity(command.parameters.entityType)) {
        this.context.playerEntity = entityRef;
      }
    }
    
    // Track created scenes
    if (command.type === 'CREATE_SCENE' && result.success) {
      const sceneRef = {
        id: result.sceneId || `scene_${Date.now()}`,
        name: command.parameters.name,
        createdAt: Date.now(),
        lastModified: Date.now()
      };
      
      this.context.scenes.set(sceneRef.name, sceneRef);
      this.context.currentScene = sceneRef.name;
    }
    
    // Infer game type
    if (!this.context.gameType) {
      this.context.gameType = this.inferGameType(command);
    }
    
    // Update conversation history
    this.context.conversationHistory.push({
      userInput: command.originalInput || '',
      command,
      result,
      timestamp: Date.now()
    });
    
    // Trim history
    if (this.context.conversationHistory.length > this.historySize) {
      this.context.conversationHistory.shift();
    }
    
    // Update last command and success
    this.context.lastCommand = command;
    this.context.lastSuccess = result.success;
    
    // Update game phase
    this.updateGamePhase();
  }
  
  /**
   * Reset the context to initial state
   */
  resetContext(): void {
    this.context = this.createInitialContext();
  }
  
  /**
   * Add an entity to the context
   */
  addEntity(entity: EntityReference): void {
    this.context.entities.set(entity.name, entity);
    this.context.lastCreatedEntity = entity;
    
    // Check if this is a player entity
    if (this.isPlayerEntity(entity.type)) {
      this.context.playerEntity = entity;
    }
  }
  
  /**
   * Remove an entity from the context
   */
  removeEntity(entityId: string): void {
    // Find entity by ID
    for (const [name, entity] of this.context.entities.entries()) {
      if (entity.id === entityId) {
        this.context.entities.delete(name);
        
        // Update last created entity if needed
        if (this.context.lastCreatedEntity?.id === entityId) {
          this.context.lastCreatedEntity = null;
        }
        
        // Update player entity if needed
        if (this.context.playerEntity?.id === entityId) {
          this.context.playerEntity = null;
        }
        
        break;
      }
    }
  }
  
  /**
   * Add a conversation turn to the history
   */
  addConversationTurn(turn: ConversationTurn): void {
    this.context.conversationHistory.push(turn);
    
    // Trim history
    if (this.context.conversationHistory.length > this.historySize) {
      this.context.conversationHistory.shift();
    }
  }
  
  /**
   * Get the conversation history
   */
  getConversationHistory(limit?: number): ConversationTurn[] {
    if (limit) {
      return this.context.conversationHistory.slice(-limit);
    }
    return [...this.context.conversationHistory];
  }
  
  /**
   * Clear the conversation history
   */
  clearHistory(): void {
    this.context.conversationHistory = [];
  }

  /**
   * Add a message to the conversation history
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    const turn: ConversationTurn = {
      userInput: role === 'user' ? content : '',
      timestamp: Date.now()
    };
    
    if (role === 'assistant') {
      turn.result = { message: content, success: true };
    }
    
    this.addConversationTurn(turn);
  }
  
  /**
   * Infer the game type from a command
   */
  private inferGameType(command: any): GameType | null {
    const indicators = {
      platformer: ['player', 'jump', 'platform', 'gravity', 'ground'],
      shooter: ['bullet', 'shoot', 'enemy', 'weapon', 'projectile'],
      puzzle: ['block', 'switch', 'door', 'key', 'solve'],
      rpg: ['character', 'stats', 'inventory', 'quest', 'dialogue'],
      racing: ['car', 'track', 'speed', 'race', 'lap'],
      strategy: ['unit', 'resource', 'build', 'economy', 'territory']
    };
    
    const text = JSON.stringify(command).toLowerCase();
    let maxScore = 0;
    let detectedType: GameType | null = null;
    
    for (const [gameType, keywords] of Object.entries(indicators)) {
      const score = keywords.reduce((sum, keyword) => 
        sum + (text.includes(keyword) ? 1 : 0), 0);
      
      if (score > maxScore) {
        maxScore = score;
        detectedType = gameType as GameType;
      }
    }
    
    return maxScore >= 2 ? detectedType : null;
  }
  
  /**
   * Check if an entity type is likely a player entity
   */
  private isPlayerEntity(entityType: string): boolean {
    const playerKeywords = ['player', 'character', 'protagonist', 'hero'];
    const lowerType = entityType.toLowerCase();
    
    return playerKeywords.some(keyword => lowerType.includes(keyword));
  }
  
  /**
   * Update the game phase based on current context
   */
  private updateGamePhase(): void {
    if (this.context.gamePhase === GamePhase.Initial) {
      if (this.context.entities.size > 0) {
        this.context.gamePhase = GamePhase.EntityCreation;
      }
    }
    
    if (this.context.gamePhase === GamePhase.EntityCreation) {
      if (this.context.playerEntity && this.context.scenes.size > 0) {
        this.context.gamePhase = GamePhase.MechanicsDefinition;
      }
    }
    
    if (this.context.gamePhase === GamePhase.MechanicsDefinition) {
      if (this.context.commandCount > 10) {
        this.context.gamePhase = GamePhase.Refinement;
      }
    }
  }
  
  /**
   * Generate suggestions based on current context
   */
  generateSuggestions(): string[] {
    const suggestions: string[] = [];
    
    // Based on current game state
    if (this.context.entities.size === 0) {
      suggestions.push(
        "Create a player character",
        "Add a background",
        "Make a simple platformer"
      );
    } else if (!this.context.playerEntity) {
      suggestions.push(
        "Add a player character",
        "Make the character controllable"
      );
    } else {
      suggestions.push(
        "Add enemies",
        "Create platforms",
        "Add collectible items",
        "Make the player jump higher"
      );
    }
    
    // Based on game type
    if (this.context.gameType === 'platformer') {
      suggestions.push(
        "Add gravity",
        "Create moving platforms",
        "Add deadly spikes"
      );
    } else if (this.context.gameType === 'shooter') {
      suggestions.push(
        "Add a shooting mechanism",
        "Create enemy waves",
        "Add power-ups"
      );
    }
    
    return suggestions;
  }
  
  /**
   * Get available actions based on current context
   */
  getAvailableActions(): string[] {
    const actions: string[] = [];
    
    // Always available actions
    actions.push("Create entity", "Create scene");
    
    // Context-dependent actions
    if (this.context.entities.size > 0) {
      actions.push("Modify entity", "Delete entity");
    }
    
    if (this.context.scenes.size > 0) {
      actions.push("Switch scene", "Modify scene");
    }
    
    if (this.context.playerEntity) {
      actions.push("Add player behavior", "Modify player");
    }
    
    return actions;
  }
  
  /**
   * Serialize context for storage
   */
  serialize(): string {
    return JSON.stringify({
      entities: Array.from(this.context.entities.entries()),
      scenes: Array.from(this.context.scenes.entries()),
      gameType: this.context.gameType,
      currentScene: this.context.currentScene,
      gamePhase: this.context.gamePhase,
      commandCount: this.context.commandCount,
      sessionStartTime: this.context.sessionStartTime
    });
  }
  
  /**
   * Deserialize context from storage
   */
  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      // Restore entities
      this.context.entities = new Map(parsed.entities);
      
      // Restore scenes
      this.context.scenes = new Map(parsed.scenes);
      
      // Restore other properties
      this.context.gameType = parsed.gameType;
      this.context.currentScene = parsed.currentScene;
      this.context.gamePhase = parsed.gamePhase;
      this.context.commandCount = parsed.commandCount;
      this.context.sessionStartTime = parsed.sessionStartTime;
      
      // Find player entity
      for (const entity of this.context.entities.values()) {
        if (this.isPlayerEntity(entity.type)) {
          this.context.playerEntity = entity;
          break;
        }
      }
      
      // Set last created entity to null
      this.context.lastCreatedEntity = null;
      
    } catch (error) {
      console.error('Failed to deserialize context:', error);
    }
  }
}