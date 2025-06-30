/**
 * Game System for managing game state and mechanics
 * Handles score, lives, level progression, etc.
 */

import { BaseSystem } from '../core/ecs/System';
import { Entity } from '../core/ecs/Entity';
import { ComponentType } from '../core/types';
import { EventBus } from '../core/events/EventBus';
import { ComponentManager } from '../core/ecs/ComponentManager';

export interface GameState {
  score: number;
  lives: number;
  level: number;
  coinsCollected: number;
  totalCoins: number;
  gameStartTime: number;
  isGameOver: boolean;
  isPaused: boolean;
}

export class GameSystem extends BaseSystem {
  private eventBus: EventBus;
  private gameState: GameState;
  private componentManager: ComponentManager;

  constructor(componentManager: ComponentManager) {
    super('GameSystem', 10); // High priority - runs last
    this.eventBus = EventBus.getInstance();
    this.componentManager = componentManager;
    
    this.gameState = {
      score: 0,
      lives: 3,
      level: 1,
      coinsCollected: 0,
      totalCoins: 0,
      gameStartTime: Date.now(),
      isGameOver: false,
      isPaused: false
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for item collection
    this.eventBus.on('item:collected', (data) => {
      this.handleItemCollection(data);
    });

    // Listen for player death
    this.eventBus.on('player:died', (data) => {
      this.handlePlayerDeath(data);
    });

    // Listen for level completion
    this.eventBus.on('level:completed', (data) => {
      this.handleLevelCompletion(data);
    });

    // Listen for enemy defeated
    this.eventBus.on('enemy:defeated', (data) => {
      this.handleEnemyDefeated(data);
    });
  }

  update(entities: Entity[], deltaTime: number): void {
    if (this.gameState.isPaused || this.gameState.isGameOver) {
      return;
    }

    // Count total coins in the level
    this.updateCoinCount(entities);

    // Check for level completion
    if (this.gameState.coinsCollected >= this.gameState.totalCoins && this.gameState.totalCoins > 0) {
      this.eventBus.emit('level:completed', {
        score: this.gameState.score,
        time: Date.now() - this.gameState.gameStartTime
      });
    }

    // Update game UI
    this.eventBus.emit('game:stateUpdated', this.gameState);
  }

  private updateCoinCount(entities: Entity[]): void {
    let totalCoins = 0;
    let visibleCoins = 0;

    for (const entity of entities) {
      const behavior = this.componentManager.getByEntity(entity, ComponentType.Behavior);
      const sprite = this.componentManager.getByEntity(entity, ComponentType.Sprite);
      
      if (behavior && behavior.data.type === 'CollectibleBehavior') {
        totalCoins++;
        if (sprite && sprite.data.visible) {
          visibleCoins++;
        }
      }
    }

    this.gameState.totalCoins = totalCoins;
  }

  private handleItemCollection(data: any): void {
    if (data.type === 'coin') {
      this.gameState.coinsCollected++;
      this.gameState.score += 100;
      
      this.eventBus.emit('game:coinCollected', {
        score: this.gameState.score,
        coinsCollected: this.gameState.coinsCollected,
        totalCoins: this.gameState.totalCoins
      });
    }
  }

  private handlePlayerDeath(data: any): void {
    this.gameState.lives--;
    
    if (this.gameState.lives <= 0) {
      this.gameState.isGameOver = true;
      this.eventBus.emit('game:gameOver', {
        finalScore: this.gameState.score,
        coinsCollected: this.gameState.coinsCollected,
        level: this.gameState.level
      });
    } else {
      this.eventBus.emit('game:playerDied', {
        livesRemaining: this.gameState.lives
      });
    }
  }

  private handleLevelCompletion(data: any): void {
    // Bonus points for completing level
    const timeBonus = Math.max(0, 10000 - (data.time / 1000) * 10);
    this.gameState.score += Math.floor(timeBonus);
    
    this.gameState.level++;
    
    this.eventBus.emit('game:levelCompleted', {
      level: this.gameState.level - 1,
      score: this.gameState.score,
      timeBonus: Math.floor(timeBonus)
    });
  }

  private handleEnemyDefeated(data: any): void {
    this.gameState.score += 200;
    
    this.eventBus.emit('game:enemyDefeated', {
      score: this.gameState.score,
      enemyType: data.type
    });
  }

  // Public methods for game control
  pauseGame(): void {
    this.gameState.isPaused = true;
    this.eventBus.emit('game:paused', {});
  }

  resumeGame(): void {
    this.gameState.isPaused = false;
    this.eventBus.emit('game:resumed', {});
  }

  resetGame(): void {
    this.gameState = {
      score: 0,
      lives: 3,
      level: 1,
      coinsCollected: 0,
      totalCoins: 0,
      gameStartTime: Date.now(),
      isGameOver: false,
      isPaused: false
    };
    
    this.eventBus.emit('game:reset', {});
  }

  getGameState(): GameState {
    return { ...this.gameState };
  }

  getRequiredComponents(): ComponentType[] {
    return []; // This system doesn't require specific components
  }
}