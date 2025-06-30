/**
 * AI Processor for the Game Vibe Engine
 * Coordinates the AI integration layer components
 */

import { IntentRecognizer } from './IntentRecognizer';
import { ContextManager } from './ContextManager';
import { CommandGenerator } from './CommandGenerator';
import { ErrorRecoverySystem } from './ErrorRecoverySystem';
import { 
  GameContext, 
  ParsedIntent, 
  RecognitionResult, 
  GDLCommand, 
  ProcessingError 
} from './types';

export class AIProcessor {
  private intentRecognizer: IntentRecognizer;
  private contextManager: ContextManager;
  private commandGenerator: CommandGenerator;
  private errorRecovery: ErrorRecoverySystem;
  private confidenceThreshold: number = 0.7;
  
  constructor() {
    this.intentRecognizer = new IntentRecognizer();
    this.contextManager = new ContextManager();
    this.commandGenerator = new CommandGenerator();
    this.errorRecovery = new ErrorRecoverySystem();
  }
  
  /**
   * Parse natural language input into an intent
   */
  async parseIntent(input: string, context: GameContext): Promise<ParsedIntent> {
    try {
      // Extract entities from input
      const entities = this.intentRecognizer.extractEntities(input, context);
      
      // Recognize intent
      const recognitionResults = this.intentRecognizer.recognize(input, context);
      
      // Check if we have a confident match
      if (recognitionResults.length > 0 && recognitionResults[0].confidence >= this.confidenceThreshold) {
        const topResult = recognitionResults[0];
        
        return {
          type: topResult.intent,
          parameters: topResult.parameters,
          confidence: topResult.confidence,
          entities,
          originalInput: input,
          needsClarification: false,
          alternativeIntents: recognitionResults.slice(1)
        };
      }
      
      // Check for ambiguity
      if (recognitionResults.length > 1 && 
          recognitionResults[0].confidence - recognitionResults[1].confidence < 0.2) {
        return {
          type: recognitionResults[0].intent,
          parameters: recognitionResults[0].parameters,
          confidence: recognitionResults[0].confidence,
          entities,
          originalInput: input,
          needsClarification: true,
          alternativeIntents: recognitionResults.slice(1)
        };
      }
      
      // Low confidence or no match
      return {
        type: recognitionResults.length > 0 ? recognitionResults[0].intent : null,
        parameters: recognitionResults.length > 0 ? recognitionResults[0].parameters : {},
        confidence: recognitionResults.length > 0 ? recognitionResults[0].confidence : 0,
        entities,
        originalInput: input,
        needsClarification: true,
        alternativeIntents: recognitionResults
      };
    } catch (error) {
      throw new ProcessingError(`Intent parsing failed: ${error.message}`);
    }
  }
  
  /**
   * Generate GDL code from a parsed intent
   */
  async generateGDL(intent: ParsedIntent, context: GameContext): Promise<string> {
    try {
      if (!intent.type) {
        throw new Error('No intent type provided');
      }
      
      // Convert ParsedIntent to RecognitionResult
      const recognitionResult: RecognitionResult = {
        intent: intent.type,
        parameters: intent.parameters,
        confidence: intent.confidence,
        originalInput: intent.originalInput,
        matchedPattern: ''
      };
      
      // Generate command
      const command = this.commandGenerator.generate(recognitionResult, context);
      
      return command.gdlCode;
    } catch (error) {
      throw new ProcessingError(`GDL generation failed: ${error.message}`);
    }
  }
  
  /**
   * Process natural language input and generate GDL code
   */
  async processInput(input: string): Promise<GDLCommand> {
    const context = this.contextManager.getContext();
    
    // Parse intent
    const intent = await this.parseIntent(input, context);
    
    // Check if clarification is needed
    if (intent.needsClarification) {
      throw new ProcessingError('Intent is ambiguous or unclear', {
        type: 'ambiguous_intent',
        alternatives: intent.alternativeIntents
      });
    }
    
    // Generate GDL code
    const gdlCode = await this.generateGDL(intent, context);
    
    // Create command
    const command: GDLCommand = {
      type: intent.type!,
      gdlCode,
      parameters: intent.parameters,
      originalInput: input,
      confidence: intent.confidence
    };
    
    return command;
  }
  
  /**
   * Update context after command execution
   */
  updateContext(command: GDLCommand, result: any): void {
    this.contextManager.updateContext(command, result);
  }
  
  /**
   * Generate suggestions based on current context
   */
  generateSuggestions(): string[] {
    return this.contextManager.generateSuggestions();
  }
  
  /**
   * Get available actions based on current context
   */
  getAvailableActions(): string[] {
    return this.contextManager.getAvailableActions();
  }
  
  /**
   * Handle errors and suggest corrections
   */
  handleError(error: any, context: GameContext): any {
    return this.errorRecovery.recoverFromError(error, context);
  }
  
  /**
   * Set the confidence threshold for intent recognition
   */
  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }
  
  /**
   * Get the current context
   */
  getContext(): GameContext {
    return this.contextManager.getContext();
  }
  
  /**
   * Reset the context
   */
  resetContext(): void {
    this.contextManager.resetContext();
  }
}