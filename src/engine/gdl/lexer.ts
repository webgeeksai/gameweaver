/**
 * GDL Lexer for tokenizing Game Description Language source code
 * Converts source text into a stream of tokens for parsing
 */

import { Token, TokenType, SourceLocation } from './types';

export class GDLLexer {
  private source: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;
  private tokens: Token[] = [];
  
  // Keywords in GDL
  private keywords: Set<string> = new Set([
    'game', 'entity', 'behavior', 'scene',
    'sprite', 'physics', 'body', 'animations',
    'properties', 'methods', 'update',
    'on', 'when', 'spawn', 'at', 'as',
    'if', 'else', 'for', 'while',
    'true', 'false', 'null',
    'grid', 'random', 'repeat', 'within',
    'every', 'after', 'during'
  ]);
  
  constructor(source: string) {
    this.source = source;
  }
  
  tokenize(): Token[] {
    this.tokens = [];
    this.position = 0;
    this.line = 1;
    this.column = 1;
    
    while (!this.isEOF()) {
      const char = this.peek();
      
      if (this.isWhitespace(char)) {
        this.consumeWhitespace();
      } else if (char === '/' && this.peek(1) === '/') {
        this.consumeSingleLineComment();
      } else if (char === '/' && this.peek(1) === '*') {
        this.consumeMultiLineComment();
      } else if (this.isDigit(char) || (char === '-' && this.isDigit(this.peek(1)))) {
        this.consumeNumber();
      } else if (char === '"' || char === "'") {
        this.consumeString();
      } else if (this.isIdentifierStart(char)) {
        this.consumeIdentifier();
      } else if (this.isPunctuation(char)) {
        this.consumePunctuation();
      } else if (this.isOperator(char)) {
        this.consumeOperator();
      } else {
        // Unrecognized character
        this.addToken(TokenType.Punctuation, this.advance());
      }
    }
    
    // Add EOF token
    this.addToken(TokenType.EOF, '');
    
    return this.tokens;
  }
  
  private consumeWhitespace(): void {
    while (!this.isEOF() && this.isWhitespace(this.peek())) {
      const char = this.advance();
      if (char === '\n') {
        this.line++;
        this.column = 1;
      }
    }
  }
  
  private consumeSingleLineComment(): void {
    // Skip the '//'
    this.advance();
    this.advance();
    
    // Read until end of line or EOF
    while (!this.isEOF() && this.peek() !== '\n') {
      this.advance();
    }
  }
  
  private consumeMultiLineComment(): void {
    // Skip the '/*'
    this.advance();
    this.advance();
    
    // Read until '*/' or EOF
    while (!this.isEOF() && !(this.peek() === '*' && this.peek(1) === '/')) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 1;
      }
      this.advance();
    }
    
    // Skip the '*/'
    if (!this.isEOF()) {
      this.advance();
      this.advance();
    }
  }
  
  private consumeNumber(): void {
    const start = this.createLocation();
    let isNegative = false;
    
    // Check for negative sign
    if (this.peek() === '-') {
      isNegative = true;
      this.advance();
    }
    
    let value = '';
    let isFloat = false;
    
    // Read integer part
    while (!this.isEOF() && this.isDigit(this.peek())) {
      value += this.advance();
    }
    
    // Check for decimal point
    if (this.peek() === '.') {
      isFloat = true;
      value += this.advance();
      
      // Read decimal part
      while (!this.isEOF() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    // Check for exponent
    if (this.peek() === 'e' || this.peek() === 'E') {
      isFloat = true;
      value += this.advance();
      
      // Check for exponent sign
      if (this.peek() === '+' || this.peek() === '-') {
        value += this.advance();
      }
      
      // Read exponent
      while (!this.isEOF() && this.isDigit(this.peek())) {
        value += this.advance();
      }
    }
    
    // Apply negative sign
    if (isNegative) {
      value = '-' + value;
    }
    
    this.addTokenWithLocation(TokenType.Number, value, start);
  }
  
  private consumeString(): void {
    const start = this.createLocation();
    const quote = this.advance(); // Save the quote character
    let value = '';
    
    while (!this.isEOF() && this.peek() !== quote) {
      // Handle escape sequences
      if (this.peek() === '\\') {
        this.advance(); // Skip the backslash
        
        switch (this.peek()) {
          case 'n': value += '\n'; break;
          case 't': value += '\t'; break;
          case 'r': value += '\r'; break;
          case '\\': value += '\\'; break;
          case '"': value += '"'; break;
          case "'": value += "'"; break;
          default: value += this.peek(); break;
        }
        
        this.advance(); // Consume the escaped character
      } else {
        value += this.advance();
      }
    }
    
    // Consume the closing quote
    if (!this.isEOF()) {
      this.advance();
    }
    
    this.addTokenWithLocation(TokenType.String, value, start);
  }
  
  private consumeIdentifier(): void {
    const start = this.createLocation();
    let value = '';
    
    while (!this.isEOF() && this.isIdentifierPart(this.peek())) {
      value += this.advance();
    }
    
    // Check if it's a keyword
    if (this.keywords.has(value)) {
      this.addTokenWithLocation(TokenType.Keyword, value, start);
    } else if (value === 'true' || value === 'false') {
      this.addTokenWithLocation(TokenType.Boolean, value, start);
    } else {
      this.addTokenWithLocation(TokenType.Identifier, value, start);
    }
  }
  
  private consumePunctuation(): void {
    const start = this.createLocation();
    const value = this.advance();
    this.addTokenWithLocation(TokenType.Punctuation, value, start);
  }
  
  private consumeOperator(): void {
    const start = this.createLocation();
    let value = this.advance();
    
    // Check for multi-character operators
    if ((value === '=' || value === '!' || value === '<' || value === '>') && this.peek() === '=') {
      value += this.advance();
    } else if ((value === '+' || value === '-' || value === '*' || value === '/') && this.peek() === '=') {
      value += this.advance();
    } else if (value === '&' && this.peek() === '&') {
      value += this.advance();
    } else if (value === '|' && this.peek() === '|') {
      value += this.advance();
    }
    
    this.addTokenWithLocation(TokenType.Operator, value, start);
  }
  
  // Helper methods
  private isEOF(): boolean {
    return this.position >= this.source.length;
  }
  
  private peek(offset: number = 0): string {
    const pos = this.position + offset;
    if (pos >= this.source.length) {
      return '';
    }
    return this.source[pos];
  }
  
  private advance(): string {
    const char = this.source[this.position++];
    this.column++;
    return char;
  }
  
  private isWhitespace(char: string): boolean {
    return /\s/.test(char);
  }
  
  private isDigit(char: string): boolean {
    return /[0-9]/.test(char);
  }
  
  private isIdentifierStart(char: string): boolean {
    return /[a-zA-Z_]/.test(char);
  }
  
  private isIdentifierPart(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
  
  private isPunctuation(char: string): boolean {
    return /[{}()\[\],:;]/.test(char);
  }
  
  private isOperator(char: string): boolean {
    return /[+\-*/%=<>!&|^~]/.test(char);
  }
  
  private createLocation(): SourceLocation {
    return {
      line: this.line,
      column: this.column,
      offset: this.position
    };
  }
  
  private addToken(type: TokenType, value: string): void {
    this.tokens.push({
      type,
      value,
      location: {
        line: this.line,
        column: this.column - value.length,
        offset: this.position - value.length
      }
    });
  }
  
  private addTokenWithLocation(type: TokenType, value: string, location: SourceLocation): void {
    this.tokens.push({
      type,
      value,
      location
    });
  }
}