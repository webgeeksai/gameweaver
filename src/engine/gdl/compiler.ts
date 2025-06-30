/**
 * GDL Compiler for transforming GDL code into executable TypeScript
 * Handles the full compilation pipeline from source to executable code
 */

import { GDLLexer } from './lexer';
import { GDLParser } from './parser';
import { SemanticAnalyzer } from './semantic';
import { CodeGenerator } from './codegen';
import { 
  CompilationResult, 
  CompilationError, 
  CompilationWarning,
  Program,
  Token,
  NodeType
} from './types';

export interface CompilerOptions {
  optimize?: boolean;
  sourceMap?: boolean;
  debug?: boolean;
}

export class GDLCompiler {
  private lexer: GDLLexer;
  private parser: GDLParser;
  private analyzer: SemanticAnalyzer;
  private generator: CodeGenerator;
  
  constructor() {
    this.lexer = new GDLLexer('');
    this.parser = new GDLParser();
    this.analyzer = new SemanticAnalyzer();
    this.generator = new CodeGenerator();
  }
  
  /**
   * Compile GDL source code to TypeScript
   */
  async compile(source: string, options: CompilerOptions = {}): Promise<CompilationResult> {
    const startTime = performance.now();
    
    try {
      // 1. Lexical analysis (tokenization)
      this.lexer = new GDLLexer(source);
      const tokenList = this.lexer.tokenize();
      
      // 2. Syntax analysis (parsing)
      this.parser = new GDLParser();
      const ast = this.parser.parse(tokenList);
      
      // Check for parsing errors
      const parserContext = this.parser['context'];
      if (parserContext && parserContext.errors && parserContext.errors.length > 0) {
        return {
          success: false,
          errors: parserContext.errors,
          warnings: parserContext.warnings || [],
          compilationTime: performance.now() - startTime
        };
      }
      
      // 3. Semantic analysis
      const semanticResult = this.analyzer.analyze(ast);
      
      if (!semanticResult.valid) {
        return {
          success: false,
          errors: semanticResult.errors,
          warnings: semanticResult.warnings,
          compilationTime: performance.now() - startTime
        };
      }
      
      // 4. Code generation
      const code = this.generator.generate(ast, options);
      
      // 5. Return successful result
      return {
        success: true,
        code,
        ast,
        warnings: semanticResult.warnings,
        compilationTime: performance.now() - startTime,
        metadata: this.extractMetadata(ast)
      };
    } catch (error) {
      // Handle unexpected errors
      return {
        success: false,
        errors: [{
          message: `Compilation error: ${error instanceof Error ? error.message : String(error)}`,
          code: 'UNEXPECTED_ERROR'
        }],
        warnings: [],
        compilationTime: performance.now() - startTime
      };
    }
  }
  
  /**
   * Validate GDL syntax without full compilation
   */
  validate(source: string): { valid: boolean; errors: CompilationError[]; warnings: CompilationWarning[] } {
    try {
      // Tokenize
      const lexer = new GDLLexer(source);
      const tokens = lexer.tokenize();
      
      // Parse
      const parser = new GDLParser();
      parser.parse(tokens);
      
      // Get errors and warnings from parser context
      const parserContext = parser['context'];
      const errors = parserContext?.errors || [];
      const warnings = parserContext?.warnings || [];
      
      // Return validation result
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          code: 'UNEXPECTED_ERROR'
        }],
        warnings: []
      };
    }
  }
  
  /**
   * Extract metadata from the AST
   */
  private extractMetadata(ast: Program): any {
    const entities: string[] = [];
    const behaviors: string[] = [];
    const scenes: string[] = [];
    const assets: string[] = [];
    
    // Traverse AST to collect metadata
    for (const node of ast.body) {
      switch (node.type) {
        case NodeType.Entity:
          entities.push((node as any).name);
          break;
        case NodeType.Behavior:
          behaviors.push((node as any).name);
          break;
        case NodeType.Scene:
          scenes.push((node as any).name);
          break;
      }
    }
    
    // Collect asset references (in a full implementation, we would scan for asset paths)
    
    return {
      entities,
      behaviors,
      scenes,
      assets
    };
  }
}