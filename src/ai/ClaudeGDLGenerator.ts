/**
 * Claude 3.5 Sonnet integration for generating GDL code
 * This class handles communication with Claude to generate efficient GDL code
 */

import { GameContext } from './types';

export class ClaudeGDLGenerator {
  private apiKey: string;
  private baseUrl: string = 'https://api.anthropic.com/v1/messages';
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || (typeof process !== 'undefined' && process.env?.ANTHROPIC_API_KEY) || '';
    if (!this.apiKey) {
      console.warn('No Anthropic API key provided. Using mock responses.');
    }
  }

  /**
   * Generate GDL code from natural language description
   */
  async generateGDL(userPrompt: string, context: GameContext): Promise<GDLGenerationResult> {
    if (!this.apiKey) {
      return this.getMockResponse(userPrompt);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const response = await this.callClaude(systemPrompt, userPrompt);
      
      return {
        success: true,
        gdlCode: this.extractGDLCode(response),
        explanation: this.extractExplanation(response),
        confidence: 0.9
      };

    } catch (error) {
      console.error('Claude API error:', error);
      
      return {
        success: false,
        error: error.message,
        fallbackCode: this.generateFallbackGDL(userPrompt, context)
      };
    }
  }

  /**
   * Build system prompt for Claude with GDL context
   */
  private buildSystemPrompt(context: GameContext): string {
    return `You are a Game Description Language (GDL) code generator for the Game Vibe Engine. Your job is to convert natural language game descriptions into efficient GDL code.

## Current Game Context:
- Game Type: ${context.gameType || 'unknown'}
- Scene: ${context.currentScene || 'Main'}
- Existing Entities: ${Array.from(context.entities.keys()).join(', ') || 'none'}
- Screen Size: 800x600

## GDL Syntax Reference:

### Entity Creation:
\`\`\`gdl
entity EntityName {
  sprite: "path/to/sprite.png"
  size: (width, height)
  position: (x, y)
  physics: "static|dynamic|kinematic|platformer"
  tags: ["tag1", "tag2"]
}
\`\`\`

### Behaviors (Mario-style platformer focus):
- PlatformerMovement: Side-scrolling movement with jumping
- PatrolBehavior: Enemy patrol patterns
- ChaseBehavior: Enemy AI that follows player
- AnimationBehavior: Sprite animations

### Common Mario-like Entities:
- Player: platformer physics, PlatformerMovement behavior
- Goomba: dynamic physics, PatrolBehavior
- Platform: static physics, no behaviors
- Coin: static physics, collectible behavior

### Scene Structure:
\`\`\`gdl
scene SceneName {
  size: (width, height)
  backgroundColor: "#color"
  physics: { gravity: (x, y) }
}
\`\`\`

## Rules:
1. Always generate complete, executable GDL code
2. Use Mario-like game conventions (800 gravity for platformers)
3. Position entities logically (ground at y=500, player at y=400)
4. Include proper physics types for each entity
5. Add appropriate behaviors for game mechanics
6. Keep code concise but functional

## Response Format:
Provide your response in this format:

\`\`\`gdl
[Your GDL code here]
\`\`\`

**Explanation:** [Brief explanation of what the code does]

Generate only valid GDL syntax. Do not include comments or explanations within the GDL code blocks.`;
  }

  /**
   * Call Claude API with the prompt
   */
  private async callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  /**
   * Extract GDL code from Claude's response
   */
  private extractGDLCode(response: string): string {
    const gdlMatch = response.match(/```gdl\n([\s\S]*?)\n```/);
    if (gdlMatch) {
      return gdlMatch[1].trim();
    }

    // If no code block, try to extract code-like content
    const lines = response.split('\n');
    const codeLines = lines.filter(line => 
      line.includes('entity ') || 
      line.includes('scene ') || 
      line.includes('sprite:') ||
      line.includes('position:') ||
      line.includes('physics:')
    );

    return codeLines.join('\n');
  }

  /**
   * Extract explanation from Claude's response
   */
  private extractExplanation(response: string): string {
    const explanationMatch = response.match(/\*\*Explanation:\*\*\s*(.*?)(?:\n\n|$)/s);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }

    // Return a portion of the response as explanation
    return response.split('\n').slice(-3).join(' ').trim();
  }

  /**
   * Generate mock response when API key is not available
   */
  private getMockResponse(userPrompt: string): GDLGenerationResult {
    const mockGDL = this.generateBasicMarioGDL(userPrompt);
    
    return {
      success: true,
      gdlCode: mockGDL,
      explanation: 'Generated basic Mario-style platformer setup (using mock response)',
      confidence: 0.8,
      isMock: true
    };
  }

  /**
   * Generate basic Mario-style GDL for common requests
   */
  private generateBasicMarioGDL(userPrompt: string): string {
    const prompt = userPrompt.toLowerCase();

    if (prompt.includes('mario') || prompt.includes('platformer') || prompt.includes('player')) {
      return `entity Player {
  sprite: "assets/player.svg"
  size: (32, 48)
  position: (100, 400)
  physics: "platformer"
  tags: ["player"]
}

entity Ground {
  sprite: "assets/ground.svg" 
  size: (800, 100)
  position: (400, 550)
  physics: "static"
  tags: ["ground", "solid"]
}

entity Platform {
  sprite: "assets/platform.svg"
  size: (200, 32)
  position: (300, 350)
  physics: "static" 
  tags: ["platform", "solid"]
}

entity Goomba {
  sprite: "assets/goomba.svg"
  size: (32, 32)
  position: (500, 450)
  physics: "dynamic"
  tags: ["enemy", "goomba"]
}`;
    }

    if (prompt.includes('enemy') || prompt.includes('goomba')) {
      const x = 200 + Math.random() * 400;
      const y = 450;
      return `entity Goomba${Math.floor(Math.random() * 1000)} {
  sprite: "assets/goomba.svg"
  size: (32, 32)
  position: (${x}, ${y})
  physics: "dynamic"
  tags: ["enemy", "goomba"]
}`;
    }

    if (prompt.includes('jumping enemy') || prompt.includes('hopping')) {
      const x = 200 + Math.random() * 400;
      const y = 450;
      return `entity JumpingGoomba${Math.floor(Math.random() * 1000)} {
  sprite: "assets/goomba.svg"
  size: (32, 32)
  position: (${x}, ${y})
  physics: "dynamic"
  tags: ["enemy", "goomba", "jumping"]
}`;
    }

    if (prompt.includes('coin') || prompt.includes('collectible')) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 200;
      return `entity Coin${Math.floor(Math.random() * 1000)} {
  sprite: "assets/coin.svg"
  size: (24, 24)
  position: (${x}, ${y})
  physics: "static"
  tags: ["coin", "collectible"]
}`;
    }

    if (prompt.includes('platform') || prompt.includes('moving platform')) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 200;
      return `entity Platform${Math.floor(Math.random() * 1000)} {
  sprite: "assets/platform.svg"
  size: (150, 32)
  position: (${x}, ${y})
  physics: "static"
  tags: ["platform", "solid"]
}`;
    }

    if (prompt.includes('power up') || prompt.includes('powerup')) {
      const x = 200 + Math.random() * 400;
      const y = 200 + Math.random() * 200;
      return `entity PowerUp${Math.floor(Math.random() * 1000)} {
  sprite: "assets/coin.svg"
  size: (32, 32)
  position: (${x}, ${y})
  physics: "static"
  tags: ["powerup", "collectible"]
}`;
    }

    // Default response
    return `entity NewEntity${Math.floor(Math.random() * 1000)} {
  sprite: "assets/player.svg"
  size: (32, 32)
  position: (${200 + Math.random() * 400}, ${200 + Math.random() * 200})
  physics: "dynamic"
  tags: ["entity"]
}`;
  }

  /**
   * Generate fallback GDL when Claude API fails
   */
  private generateFallbackGDL(userPrompt: string, context: GameContext): string {
    return this.generateBasicMarioGDL(userPrompt);
  }
}

interface GDLGenerationResult {
  success: boolean;
  gdlCode?: string;
  explanation?: string;
  confidence?: number;
  error?: string;
  fallbackCode?: string;
  isMock?: boolean;
}