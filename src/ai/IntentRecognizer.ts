/**
 * Intent Recognition System for the Game Vibe Engine
 * Parses natural language input and extracts game creation intents
 */

import { GameContext, IntentType, RecognitionResult, IntentPattern, NamedEntity } from './types';
import { Vector2 } from '../core/math/Vector2';

export class IntentRecognizer {
  private patterns: IntentPattern[] = [];
  
  constructor() {
    this.initializePatterns();
  }
  
  /**
   * Initialize the intent recognition patterns
   */
  private initializePatterns(): void {
    // Entity creation patterns
    this.patterns.push({
      pattern: /(?:add|create|spawn|make)\s+(?:a\s+)?(\w+)(?:\s+at\s+(.+))?/i,
      intent: IntentType.CREATE_ENTITY,
      confidence: 0.9,
      extractors: [
        { name: 'entityType', group: 1, transform: 'capitalize' },
        { name: 'position', group: 2, transform: 'parsePosition', default: 'center' }
      ]
    });
    
    // Behavior modification patterns
    this.patterns.push({
      pattern: /make\s+(?:the\s+)?(\w+)?\s+(jump|move|shoot|patrol|follow)/i,
      intent: IntentType.ADD_BEHAVIOR,
      confidence: 0.85,
      extractors: [
        { name: 'target', group: 1, transform: 'resolveEntity', default: 'last' },
        { name: 'behavior', group: 2, transform: 'behaviorName' }
      ],
      context: [{ requires: 'hasEntities', message: 'No entities available to modify' }]
    });
    
    // Property modification patterns
    this.patterns.push({
      pattern: /(?:make|change|set)\s+(?:the\s+)?(\w+)?\s+(?:more\s+)?(faster|slower|bigger|smaller|red|blue|green|invisible)/i,
      intent: IntentType.MODIFY_PROPERTY,
      confidence: 0.8,
      extractors: [
        { name: 'target', group: 1, transform: 'resolveEntity', default: 'last' },
        { name: 'modification', group: 2, transform: 'propertyChange' }
      ]
    });
    
    // Movement commands
    this.patterns.push({
      pattern: /move\s+(?:the\s+)?(\w+)?\s+(?:to\s+)?(.+)/i,
      intent: IntentType.MOVE_ENTITY,
      confidence: 0.85,
      extractors: [
        { name: 'target', group: 1, transform: 'resolveEntity', default: 'last' },
        { name: 'destination', group: 2, transform: 'parsePosition' }
      ]
    });
    
    // Game mechanics
    this.patterns.push({
      pattern: /add\s+(?:a\s+)?(?:physics|gravity|collision)/i,
      intent: IntentType.ADD_PHYSICS,
      confidence: 0.9,
      extractors: []
    });
    
    // Scene creation
    this.patterns.push({
      pattern: /create\s+(?:a\s+)?(?:new\s+)?scene(?:\s+called\s+(\w+))?/i,
      intent: IntentType.CREATE_SCENE,
      confidence: 0.9,
      extractors: [
        { name: 'sceneName', group: 1, transform: 'capitalize', default: 'NewScene' }
      ]
    });
    
    // Game creation
    this.patterns.push({
      pattern: /create\s+(?:a\s+)?(platformer|shooter|puzzle|rpg|racing|strategy)(?:\s+game)?/i,
      intent: IntentType.CREATE_GAME,
      confidence: 0.95,
      extractors: [
        { name: 'gameType', group: 1, transform: 'lowercase' }
      ]
    });
  }
  
  /**
   * Recognize intents from natural language input
   */
  recognize(input: string, context: GameContext): RecognitionResult[] {
    const results: RecognitionResult[] = [];
    
    for (const pattern of this.patterns) {
      const match = input.match(pattern.pattern);
      if (match) {
        // Check context requirements
        if (pattern.context && !this.validateContext(pattern.context, context)) {
          continue;
        }
        
        // Extract parameters
        const parameters = this.extractParameters(match, pattern.extractors, context);
        
        results.push({
          intent: pattern.intent,
          confidence: pattern.confidence,
          parameters,
          originalInput: input,
          matchedPattern: pattern.pattern.source
        });
      }
    }
    
    // Sort by confidence
    return results.sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Validate context requirements for a pattern
   */
  private validateContext(contextRequirements: any[], context: GameContext): boolean {
    for (const requirement of contextRequirements) {
      switch (requirement.requires) {
        case 'hasEntities':
          if (context.entities.size === 0) {
            return false;
          }
          break;
          
        case 'hasScenes':
          if (context.scenes.size === 0) {
            return false;
          }
          break;
          
        // Add more context validations as needed
      }
    }
    
    return true;
  }
  
  /**
   * Extract parameters from a regex match using the pattern's extractors
   */
  private extractParameters(match: RegExpMatchArray, extractors: any[], context: GameContext): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    for (const extractor of extractors) {
      let value = match[extractor.group];
      
      // Use default if value is not found
      if (!value && extractor.default !== undefined) {
        value = extractor.default;
      }
      
      // Apply transformation if specified
      if (value && extractor.transform) {
        value = this.transformValue(value, extractor.transform, context);
      }
      
      parameters[extractor.name] = value;
    }
    
    return parameters;
  }
  
  /**
   * Transform a value based on the specified transformation
   */
  private transformValue(value: string, transform: string, context: GameContext): any {
    switch (transform) {
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1);
        
      case 'lowercase':
        return value.toLowerCase();
        
      case 'parsePosition':
        return this.parsePosition(value);
        
      case 'resolveEntity':
        return this.resolveEntity(value, context);
        
      case 'behaviorName':
        return this.getBehaviorName(value);
        
      case 'propertyChange':
        return this.getPropertyChange(value);
        
      default:
        return value;
    }
  }
  
  /**
   * Parse a position string into a Vector2
   */
  private parsePosition(positionStr: string): Vector2 | string {
    // Check for common position keywords
    if (positionStr === 'center') {
      return new Vector2(400, 300);
    }
    
    if (positionStr === 'top') {
      return new Vector2(400, 100);
    }
    
    if (positionStr === 'bottom') {
      return new Vector2(400, 500);
    }
    
    if (positionStr === 'left') {
      return new Vector2(100, 300);
    }
    
    if (positionStr === 'right') {
      return new Vector2(700, 300);
    }
    
    // Try to parse coordinates
    const coordsMatch = positionStr.match(/\[?\s*(\d+)\s*,\s*(\d+)\s*\]?/);
    if (coordsMatch) {
      const x = parseInt(coordsMatch[1], 10);
      const y = parseInt(coordsMatch[2], 10);
      return new Vector2(x, y);
    }
    
    // Return the original string if parsing fails
    return positionStr;
  }
  
  /**
   * Resolve an entity reference from the context
   */
  private resolveEntity(reference: string, context: GameContext): string {
    // Direct name lookup
    if (context.entities.has(reference)) {
      return reference;
    }
    
    // Special references
    switch (reference.toLowerCase()) {
      case 'last':
      case 'it':
      case 'that':
        return context.lastCreatedEntity?.name || '';
        
      case 'player':
        return context.playerEntity?.name || '';
        
      case 'all':
        return '*'; // Special case for bulk operations
    }
    
    // Fuzzy matching
    const candidates = Array.from(context.entities.keys()) as string[];
    const match = this.fuzzyMatch(reference, candidates);
    
    return match || reference;
  }
  
  /**
   * Get the behavior name from a verb
   */
  private getBehaviorName(verb: string): string {
    const behaviorMap: Record<string, string> = {
      'jump': 'Jumpable',
      'move': 'Moveable',
      'shoot': 'Shooter',
      'patrol': 'PatrolAI',
      'follow': 'FollowBehavior'
    };
    
    return behaviorMap[verb.toLowerCase()] || `${verb.charAt(0).toUpperCase() + verb.slice(1)}Behavior`;
  }
  
  /**
   * Get property change from a modification keyword
   */
  private getPropertyChange(modification: string): Record<string, any> {
    const modificationMap: Record<string, Record<string, any>> = {
      'faster': { property: 'speed', operation: 'multiply', value: 1.5 },
      'slower': { property: 'speed', operation: 'multiply', value: 0.5 },
      'bigger': { property: 'scale', operation: 'multiply', value: 1.5 },
      'smaller': { property: 'scale', operation: 'multiply', value: 0.5 },
      'red': { property: 'color', operation: 'set', value: '#ff0000' },
      'blue': { property: 'color', operation: 'set', value: '#0000ff' },
      'green': { property: 'color', operation: 'set', value: '#00ff00' },
      'invisible': { property: 'alpha', operation: 'set', value: 0 }
    };
    
    return modificationMap[modification.toLowerCase()] || {};
  }
  
  /**
   * Find the closest match for a string in a list of candidates
   */
  private fuzzyMatch(input: string, candidates: string[]): string | null {
    if (candidates.length === 0) return null;
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const candidate of candidates) {
      const score = this.calculateSimilarity(input.toLowerCase(), candidate.toLowerCase());
      if (score > bestScore && score > 0.6) { // Threshold for matching
        bestScore = score;
        bestMatch = candidate;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Calculate string similarity (0-1) between two strings
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;
    
    const matrix: number[][] = [];
    
    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    // Calculate similarity as 1 - normalized distance
    const maxLength = Math.max(a.length, b.length);
    return 1 - (matrix[b.length][a.length] / maxLength);
  }
  
  /**
   * Extract named entities from input text
   */
  extractEntities(input: string, context: GameContext): NamedEntity[] {
    const entities: NamedEntity[] = [];
    
    // Extract entity references
    const words = input.split(/\s+/);
    
    for (const word of words) {
      // Check if word is an entity name
      if (context.entities.has(word)) {
        entities.push({
          type: 'ENTITY',
          text: word,
          confidence: 0.95,
          entityId: context.entities.get(word)?.id
        });
      }
      
      // Check for position references
      const positionMatch = word.match(/\[(\d+),(\d+)\]/);
      if (positionMatch) {
        entities.push({
          type: 'POSITION',
          text: word,
          confidence: 0.9,
          position: new Vector2(parseInt(positionMatch[1]), parseInt(positionMatch[2]))
        });
      }
      
      // Check for color references
      const colorMatch = word.match(/#([0-9a-f]{3,6})/i);
      if (colorMatch) {
        entities.push({
          type: 'COLOR',
          text: word,
          confidence: 0.9,
          color: word
        });
      }
    }
    
    return entities;
  }
}