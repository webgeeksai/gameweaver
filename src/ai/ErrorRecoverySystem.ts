/**
 * Error Recovery System for the Game Vibe Engine
 * Provides intelligent error handling and recovery suggestions
 */

import { GameContext, ProcessingError, RecoveryResult, RecoveryOption } from './types';

export class ErrorRecoverySystem {
  /**
   * Recover from recognition failures
   */
  recoverFromRecognitionFailure(input: string, context: GameContext): RecoveryResult {
    // Analyze what went wrong
    const analysis = this.analyzeFailure(input, context);
    
    switch (analysis.type) {
      case 'UNKNOWN_ENTITY':
        return {
          type: 'suggestion',
          message: `I don't know about "${analysis.unknownEntity}". Did you mean one of these?`,
          suggestions: this.findSimilarEntities(analysis.unknownEntity, context)
        };
        
      case 'AMBIGUOUS_REFERENCE':
        return {
          type: 'clarification',
          message: `Which "${analysis.ambiguousEntity}" do you mean?`,
          options: analysis.possibleMatches
        };
        
      case 'INCOMPLETE_COMMAND':
        return {
          type: 'prompt',
          message: `I need more information. ${analysis.missingInfo}`,
          expectedParams: analysis.expectedParams
        };
        
      case 'UNSUPPORTED_FEATURE':
        return {
          type: 'alternative',
          message: `I can't do that yet, but I can help you with:`,
          alternatives: this.findAlternatives(analysis.requestedFeature)
        };
        
      default:
        return {
          type: 'suggestion',
          message: 'I didn\'t understand that. Try rephrasing or use one of these suggestions:',
          suggestions: this.generateGeneralSuggestions(context)
        };
    }
  }
  
  /**
   * Recover from a processing error
   */
  recoverFromError(error: any, context: GameContext): RecoveryResult {
    // Check if it's a known processing error
    if (error instanceof ProcessingError) {
      switch (error.type) {
        case 'ambiguous_intent':
          return {
            type: 'clarification',
            message: 'I\'m not sure what you want to do. Did you mean:',
            options: error.data.alternatives.map((alt: any) => ({
              id: alt.intent,
              title: this.getIntentDescription(alt.intent),
              description: this.describeIntent(alt),
              confidence: alt.confidence
            }))
          };
          
        case 'missing_parameters':
          return {
            type: 'prompt',
            message: `I need more information to ${this.getIntentDescription(error.data.intent)}:`,
            expectedParams: error.data.missingParams
          };
          
        case 'validation_error':
          return {
            type: 'suggestion',
            message: `There's a problem with your request: ${error.message}`,
            suggestions: this.suggestCorrections(error.data.errors)
          };
          
        default:
          return {
            type: 'error',
            message: error.message,
            suggestions: this.generateGeneralSuggestions(context)
          };
      }
    }
    
    // Generic error handling
    return {
      type: 'error',
      message: error.message || 'An unexpected error occurred',
      suggestions: this.generateGeneralSuggestions(context)
    };
  }
  
  /**
   * Suggest corrections for common mistakes
   */
  suggestCorrections(error: any): string[] {
    const suggestions: string[] = [];
    
    switch (error.type) {
      case 'REFERENCE_ERROR':
        const similar = this.findSimilarNames(error.reference);
        suggestions.push(...similar.map(name => `Did you mean "${name}"?`));
        break;
        
      case 'TYPE_ERROR':
        suggestions.push(`Expected ${error.expectedType}, got ${error.actualType}`);
        suggestions.push(`Try: ${this.getTypeExample(error.expectedType)}`);
        break;
        
      case 'SYNTAX_ERROR':
        suggestions.push('Check your spelling and try again');
        if (error.nearbyTokens) {
          suggestions.push(`Near: "${error.nearbyTokens.join(' ')}"`);
        }
        break;
    }
    
    return suggestions;
  }
  
  /**
   * Analyze a failure to determine what went wrong
   */
  private analyzeFailure(input: string, context: GameContext): any {
    // Check for unknown entity references
    const entityNames = Array.from(context.entities.keys());
    const words = input.split(/\s+/);
    
    for (const word of words) {
      // Skip common words
      if (this.isCommonWord(word)) continue;
      
      // Check if it looks like an entity reference
      if (this.looksLikeEntityReference(word)) {
        // Check if it's unknown
        if (!entityNames.includes(word)) {
          // Find similar entities
          const similar = this.findSimilarNames(word, entityNames);
          if (similar.length > 0) {
            return {
              type: 'UNKNOWN_ENTITY',
              unknownEntity: word,
              similarEntities: similar
            };
          }
        }
      }
    }
    
    // Check for incomplete commands
    const createMatch = input.match(/(?:add|create|make)\s+(?:a\s+)?(\w+)/i);
    if (createMatch && !createMatch[1]) {
      return {
        type: 'INCOMPLETE_COMMAND',
        missingInfo: 'What do you want to create?',
        expectedParams: ['entityType']
      };
    }
    
    // Check for unsupported features
    const unsupportedFeatures = [
      { keyword: '3d', feature: '3D graphics' },
      { keyword: 'multiplayer', feature: 'multiplayer' },
      { keyword: 'save', feature: 'save/load' },
      { keyword: 'vr', feature: 'virtual reality' }
    ];
    
    for (const { keyword, feature } of unsupportedFeatures) {
      if (input.toLowerCase().includes(keyword)) {
        return {
          type: 'UNSUPPORTED_FEATURE',
          requestedFeature: feature
        };
      }
    }
    
    // Default analysis
    return {
      type: 'UNKNOWN_COMMAND',
      input
    };
  }
  
  /**
   * Find similar entity names
   */
  private findSimilarNames(name: string, candidates: string[] = []): string[] {
    const similar: string[] = [];
    
    for (const candidate of candidates) {
      const similarity = this.calculateStringSimilarity(name.toLowerCase(), candidate.toLowerCase());
      if (similarity > 0.6) {
        similar.push(candidate);
      }
    }
    
    return similar;
  }
  
  /**
   * Calculate string similarity (0-1) between two strings
   */
  private calculateStringSimilarity(a: string, b: string): number {
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
   * Check if a word is a common word (not likely an entity reference)
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else',
      'to', 'from', 'in', 'on', 'at', 'by', 'with', 'about',
      'add', 'create', 'make', 'set', 'change', 'move', 'delete',
      'player', 'enemy', 'game', 'scene', 'level'
    ];
    
    return commonWords.includes(word.toLowerCase());
  }
  
  /**
   * Check if a word looks like an entity reference
   */
  private looksLikeEntityReference(word: string): boolean {
    // Entity references are typically nouns, often with capital letters
    return /^[A-Z][a-z]*$/.test(word) || 
           /^[a-z]+[A-Z][a-z]*$/.test(word) || // camelCase
           word.length > 3;
  }
  
  /**
   * Find alternative suggestions for unsupported features
   */
  private findAlternatives(feature: string): string[] {
    switch (feature.toLowerCase()) {
      case '3d graphics':
        return [
          'Create a 2D side-scrolling game',
          'Add depth with parallax backgrounds',
          'Use scaling to create a pseudo-3D effect'
        ];
        
      case 'multiplayer':
        return [
          'Create a two-player game on the same device',
          'Add AI opponents for a multiplayer-like experience',
          'Create a high score system for competition'
        ];
        
      case 'save/load':
        return [
          'Create a level selection screen',
          'Use checkpoints within levels',
          'Add a game over screen with restart option'
        ];
        
      case 'virtual reality':
        return [
          'Create an immersive 2D experience',
          'Add first-person perspective elements',
          'Use fullscreen mode for greater immersion'
        ];
        
      default:
        return [
          'Create a simple game with basic mechanics',
          'Focus on core gameplay elements',
          'Start with a prototype and add features gradually'
        ];
    }
  }
  
  /**
   * Generate general suggestions based on context
   */
  private generateGeneralSuggestions(context: GameContext): string[] {
    const suggestions: string[] = [];
    
    // Based on game phase
    switch (context.gamePhase) {
      case 'initial':
        suggestions.push(
          'Create a player character',
          'Create a platformer game',
          'Add a background'
        );
        break;
        
      case 'entity_creation':
        suggestions.push(
          'Add enemies to the game',
          'Create platforms for the player to jump on',
          'Add collectible items'
        );
        break;
        
      case 'mechanics_definition':
        suggestions.push(
          'Make the player jump when space is pressed',
          'Add gravity to the game',
          'Make enemies patrol back and forth'
        );
        break;
        
      case 'refinement':
        suggestions.push(
          'Add a score system',
          'Create a game over screen',
          'Add sound effects'
        );
        break;
    }
    
    return suggestions;
  }
  
  /**
   * Get a description for an intent type
   */
  private getIntentDescription(intent: string): string {
    switch (intent) {
      case 'CREATE_ENTITY':
        return 'create a new entity';
      case 'ADD_BEHAVIOR':
        return 'add a behavior to an entity';
      case 'MODIFY_PROPERTY':
        return 'modify an entity property';
      case 'MOVE_ENTITY':
        return 'move an entity';
      case 'CREATE_SCENE':
        return 'create a new scene';
      case 'CREATE_GAME':
        return 'create a new game';
      default:
        return 'perform this action';
    }
  }
  
  /**
   * Describe an intent in natural language
   */
  private describeIntent(intent: any): string {
    switch (intent.intent) {
      case 'CREATE_ENTITY':
        return `Create a ${intent.parameters.entityType || 'new entity'}${
          intent.parameters.position ? ` at position ${intent.parameters.position}` : ''
        }`;
        
      case 'ADD_BEHAVIOR':
        return `Add ${intent.parameters.behavior || 'a behavior'} to ${
          intent.parameters.target || 'the entity'
        }`;
        
      case 'MODIFY_PROPERTY':
        const prop = intent.parameters.modification?.property || 'property';
        const value = intent.parameters.modification?.value || 'value';
        return `Change the ${prop} of ${intent.parameters.target || 'the entity'} to ${value}`;
        
      case 'MOVE_ENTITY':
        return `Move ${intent.parameters.target || 'the entity'} to ${
          intent.parameters.destination || 'a new position'
        }`;
        
      case 'CREATE_SCENE':
        return `Create a new scene${
          intent.parameters.sceneName ? ` called ${intent.parameters.sceneName}` : ''
        }`;
        
      case 'CREATE_GAME':
        return `Create a ${intent.parameters.gameType || 'new'} game`;
        
      default:
        return intent.originalInput || 'Perform an action';
    }
  }
  
  /**
   * Get an example value for a type
   */
  private getTypeExample(type: string): string {
    switch (type) {
      case 'string':
        return '"text"';
      case 'number':
        return '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[1, 2, 3]';
      case 'object':
        return '{ key: "value" }';
      case 'position':
        return '[100, 200]';
      case 'color':
        return '"#ff0000"';
      default:
        return 'value';
    }
  }
}