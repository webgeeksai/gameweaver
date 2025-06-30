/**
 * ID Generator utility for creating unique identifiers
 * Provides different strategies for ID generation
 */

import { v4 as uuidv4 } from 'uuid';

export enum IdStrategy {
  UUID = 'uuid',
  Sequential = 'sequential',
  Timestamp = 'timestamp',
  Custom = 'custom'
}

export class IdGenerator {
  private strategy: IdStrategy;
  private prefix: string;
  private counter: number = 0;
  private customGenerator?: () => string;
  
  constructor(
    strategy: IdStrategy = IdStrategy.UUID, 
    prefix: string = '', 
    customGenerator?: () => string
  ) {
    this.strategy = strategy;
    this.prefix = prefix;
    this.customGenerator = customGenerator;
  }
  
  generate(): string {
    let id: string;
    
    switch (this.strategy) {
      case IdStrategy.UUID:
        id = uuidv4();
        break;
        
      case IdStrategy.Sequential:
        id = (++this.counter).toString().padStart(8, '0');
        break;
        
      case IdStrategy.Timestamp:
        id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
        break;
        
      case IdStrategy.Custom:
        if (!this.customGenerator) {
          throw new Error('Custom ID generator not provided');
        }
        id = this.customGenerator();
        break;
        
      default:
        id = uuidv4();
    }
    
    return this.prefix ? `${this.prefix}${id}` : id;
  }
  
  // Generate multiple IDs at once
  generateBulk(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generate());
    }
    return ids;
  }
  
  // Reset the counter (for sequential strategy)
  resetCounter(value: number = 0): void {
    this.counter = value;
  }
  
  // Change the strategy
  setStrategy(strategy: IdStrategy, customGenerator?: () => string): void {
    this.strategy = strategy;
    if (strategy === IdStrategy.Custom) {
      this.customGenerator = customGenerator;
    }
  }
  
  // Change the prefix
  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
  
  // Get current strategy
  getStrategy(): IdStrategy {
    return this.strategy;
  }
  
  // Get current prefix
  getPrefix(): string {
    return this.prefix;
  }
}

// Default ID generators for common use cases
export const entityIdGenerator = new IdGenerator(IdStrategy.UUID, 'e_');
export const componentIdGenerator = new IdGenerator(IdStrategy.UUID, 'c_');
export const sceneIdGenerator = new IdGenerator(IdStrategy.UUID, 's_');
export const assetIdGenerator = new IdGenerator(IdStrategy.UUID, 'a_');