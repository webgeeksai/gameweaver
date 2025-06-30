import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/core/GameEngine';
import { ComponentType, PhysicsMode } from '../engine/core/types';
import { Vector2 } from '../engine/core/math/Vector2';
import { globalEventBus } from '../engine/core/events/EventBus';
import { SceneDefinition } from '../engine/core/scene/Scene';
import { GDLRuntime } from '../engine/gdl/runtime';
import { ClaudeGDLGenerator } from '../ai/ClaudeGDLGenerator';
import PerformanceMonitor from './PerformanceMonitor';
import SimpleLevelEditor from './SimpleLevelEditor';
import ErrorBoundary from './ErrorBoundary';

interface GamePreviewProps {
  gdlCode?: string;
  compiledCode?: string;
  width?: number;
  height?: number;
  onGDLExecuted?: (success: boolean, message: string) => void;
}

const GamePreview: React.FC<GamePreviewProps> = ({
  gdlCode,
  compiledCode,
  width = 800,
  height = 600,
  onGDLExecuted
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameEngineRef = useRef<GameEngine | null>(null);
  const gdlRuntimeRef = useRef<GDLRuntime | null>(null);
  const claudeGeneratorRef = useRef<ClaudeGDLGenerator | null>(null);
  
  const [fps, setFps] = useState(0);
  const [entityCount, setEntityCount] = useState(0);
  const [activeScene, setActiveScene] = useState<string>('');
  const [showPerformance, setShowPerformance] = useState(false);
  const [sceneInitialized, setSceneInitialized] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [particleCount, setParticleCount] = useState(0);
  const [gdlStatus, setGdlStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');
  const [gameState, setGameState] = useState({
    score: 0,
    lives: 3,
    coinsCollected: 0,
    totalCoins: 0,
    level: 1
  });
  const [isLevelEditorMode, setIsLevelEditorMode] = useState(false);
  const [isPlayingCustomLevel, setIsPlayingCustomLevel] = useState(false);
  const [savedEditorState, setSavedEditorState] = useState<any>(null);
  
  // Initialize game engine
  useEffect(() => {
    console.log("GamePreview: Initializing game engine");
    if (canvasRef.current && !gameEngineRef.current) {
      try {
        console.log("GamePreview: Creating GameEngine instance");
        const engine = new GameEngine({ 
          canvas: canvasRef.current,
          config: {
            debug: {
              enabled: true,
              showFPS: true,
              showColliders: true,
              showBounds: true,
              logLevel: 'debug'
            },
            physics: {
              debug: true
            }
          }
        });
        gameEngineRef.current = engine;
        
        // Initialize GDL Runtime
        console.log("GamePreview: Initializing GDL Runtime");
        const gdlRuntime = new GDLRuntime(engine);
        gdlRuntimeRef.current = gdlRuntime;
        
        // Initialize Claude GDL Generator
        console.log("GamePreview: Initializing Claude GDL Generator");
        const claudeGenerator = new ClaudeGDLGenerator();
        claudeGeneratorRef.current = claudeGenerator;
        
        // Create initial Mario-like scene (only once and not in level editor mode)
        if (!sceneInitialized && !isLevelEditorMode) {
          console.log("GamePreview: Creating initial Mario scene");
          createMarioScene(gdlRuntime);
          setSceneInitialized(true);
        }
        
        // Start the engine
        console.log("GamePreview: Starting engine");
        engine.start();
        
        // Focus the canvas for input
        if (canvasRef.current) {
          canvasRef.current.focus();
        }
        
        // Setup stats update interval
        console.log("GamePreview: Setting up stats update interval");
        const statsInterval = setInterval(() => {
          if (engine) {
            setFps(engine.getFPS());
            setEntityCount(engine.getEntityManager().getEntityCount());
            setParticleCount(engine.getParticleSystem().getTotalParticleCount());
            
            const scene = engine.getActiveScene();
            if (scene) {
              setActiveScene(scene.name);
            }
            
            // Update debug info
            const inputSystem = engine.getInputSystem();
            const activeKeys = inputSystem.getActiveKeys();
            setDebugInfo([
              `Active Keys: ${activeKeys.join(', ')}`,
              `Mouse: ${inputSystem.getMousePosition().toString()}`,
              `Touches: ${inputSystem.getActiveTouches().length}`
            ]);
          }
        }, 500);
        
        // Setup GDL event listeners
        globalEventBus.on('gdl:executed', (data) => {
          setGdlStatus('success');
          onGDLExecuted?.(true, 'GDL code executed successfully');
        });
        
        globalEventBus.on('gdl:error', (data) => {
          setGdlStatus('error');
          onGDLExecuted?.(false, data.error);
        });

        // Setup game event listeners
        globalEventBus.on('game:stateUpdated', (state) => {
          setGameState(state);
        });

        globalEventBus.on('game:coinCollected', (data) => {
          console.log('Coin collected!', data);
        });

        globalEventBus.on('game:levelCompleted', (data) => {
          console.log('Level completed!', data);
        });
        
        // Cleanup on unmount
        return () => {
          console.log("GamePreview: Cleaning up engine");
          clearInterval(statsInterval);
          engine.stop();
          gameEngineRef.current = null;
          gdlRuntimeRef.current = null;
          claudeGeneratorRef.current = null;
        };
      } catch (error) {
        console.error("GamePreview: Error initializing game engine", error);
      }
    }
  }, [isLevelEditorMode]);

  // Execute GDL code when provided
  useEffect(() => {
    if (gdlCode && gdlRuntimeRef.current) {
      console.log("GamePreview: Executing GDL code", gdlCode);
      executeGDLCode(gdlCode);
    }
  }, [gdlCode]);

  /**
   * Create initial Mario-like scene using GDL
   */
  const createMarioScene = async (gdlRuntime: GDLRuntime) => {
    const marioGDL = `
entity Player {
  sprite: "assets/player.svg"
  size: (32, 48)
  position: (-200, 220)
  physics: "platformer"
  tags: ["player"]
}

entity Ground {
  sprite: "assets/ground.svg"
  size: (900, 60)
  position: (0, 270)
  physics: "static"
  tags: ["ground", "solid"]
}

entity Platform1 {
  sprite: "assets/platform.svg"
  size: (120, 20)
  position: (-200, 150)
  physics: "static"
  tags: ["platform", "solid"]
}

entity Platform2 {
  sprite: "assets/platform.svg"
  size: (120, 20)
  position: (0, 100)
  physics: "static"
  tags: ["platform", "solid"]
}

entity Platform3 {
  sprite: "assets/platform.svg"
  size: (120, 20)
  position: (200, 50)
  physics: "static"
  tags: ["platform", "solid"]
}

entity Goomba1 {
  sprite: "assets/goomba.svg"
  size: (28, 28)
  position: (-100, 230)
  physics: "dynamic"
  tags: ["enemy", "goomba"]
}

entity Goomba2 {
  sprite: "assets/goomba.svg"
  size: (28, 28)
  position: (100, 230)
  physics: "dynamic"
  tags: ["enemy", "goomba"]
}

entity Coin1 {
  sprite: "assets/coin.svg"
  size: (20, 20)
  position: (-200, 100)
  physics: "static"
  tags: ["coin", "collectible"]
}

entity Coin2 {
  sprite: "assets/coin.svg"
  size: (20, 20)
  position: (0, 50)
  physics: "static"
  tags: ["coin", "collectible"]
}

entity Coin3 {
  sprite: "assets/coin.svg"
  size: (20, 20)
  position: (200, 0)
  physics: "static"
  tags: ["coin", "collectible"]
}

entity Coin4 {
  sprite: "assets/coin.svg"
  size: (20, 20)
  position: (-300, 200)
  physics: "static"
  tags: ["coin", "collectible"]
}
`;

    try {
      await gdlRuntime.execute(marioGDL);
      console.log("GamePreview: Initial Mario scene created successfully");
    } catch (error) {
      console.error("GamePreview: Error creating Mario scene", error);
    }
  };

  /**
   * Execute GDL code through the runtime
   */
  const executeGDLCode = async (code: string) => {
    if (!gdlRuntimeRef.current) {
      console.error("GamePreview: GDL Runtime not initialized");
      return;
    }

    setGdlStatus('executing');
    
    try {
      const result = await gdlRuntimeRef.current.execute(code);
      
      if (result.success) {
        console.log("GamePreview: GDL execution successful", result);
        setGdlStatus('success');
      } else {
        console.error("GamePreview: GDL execution failed", result);
        setGdlStatus('error');
      }
    } catch (error) {
      console.error("GamePreview: GDL execution error", error);
      setGdlStatus('error');
    }
  };

  /**
   * Generate GDL code using Claude for testing
   */
  const generateTestGDL = async (prompt: string) => {
    if (!claudeGeneratorRef.current || !gdlRuntimeRef.current) {
      console.error("GamePreview: Generators not initialized");
      return;
    }

    try {
      const context = {
        gameType: 'platformer',
        currentScene: 'Main',
        entities: new Map(),
        variables: new Map()
      };

      const result = await claudeGeneratorRef.current.generateGDL(prompt, context);
      
      if (result.success && result.gdlCode) {
        console.log("GamePreview: Generated GDL code", result.gdlCode);
        await executeGDLCode(result.gdlCode);
      }
    } catch (error) {
      console.error("GamePreview: Error generating GDL", error);
    }
  };

  /**
   * Handle playing a custom level from the level editor
   */
  const handlePlayCustomLevel = async (gdlCode: string, editorState: any) => {
    try {
      console.log("GamePreview: Playing custom level");
      console.log("GamePreview: GDL Code:", gdlCode);
      console.log("GamePreview: Editor State:", editorState);
      
      // Save editor state before switching modes
      setSavedEditorState(editorState);
      
      setIsPlayingCustomLevel(true);
      setIsLevelEditorMode(false);
      
      // Clear existing level and create new one
      if (gdlRuntimeRef.current && gameEngineRef.current) {
        try {
          console.log("GamePreview: Clearing existing entities");
          // First clear all existing entities
          gdlRuntimeRef.current.clearAllEntities();
          
          console.log("GamePreview: Resetting camera");
          // Reset camera to origin
          gameEngineRef.current.setCameraPosition(0, 0);
          
          console.log("GamePreview: Executing GDL code");
          // Execute the custom level GDL
          const result = await gdlRuntimeRef.current.execute(gdlCode);
          console.log("GamePreview: GDL execution result:", result);
          
          if (result.success) {
            console.log("GamePreview: Custom level loaded successfully");
          } else {
            console.error("GamePreview: GDL execution failed:", result.error);
            setIsPlayingCustomLevel(false);
            setIsLevelEditorMode(true);
            return;
          }
          
          // Focus the canvas for input
          if (canvasRef.current) {
            canvasRef.current.focus();
          }
          
          // Check entity count after loading
          const entityCount = gameEngineRef.current.getEntityManager().getEntityCount();
          console.log("GamePreview: Entities loaded:", entityCount);
          
        } catch (error) {
          console.error("GamePreview: Error loading custom level", error);
          setIsPlayingCustomLevel(false);
          setIsLevelEditorMode(true);
        }
      } else {
        console.error("GamePreview: GDL Runtime or Game Engine not available");
        setIsPlayingCustomLevel(false);
        setIsLevelEditorMode(true);
      }
    } catch (error) {
      console.error("GamePreview: Error in handlePlayCustomLevel", error);
      // Reset to safe state
      setIsPlayingCustomLevel(false);
      setIsLevelEditorMode(true);
    }
  };

  /**
   * Return to level editor from play mode
   */
  const handleReturnToEditor = () => {
    console.log("GamePreview: Returning to editor with saved state", savedEditorState);
    setIsPlayingCustomLevel(false);
    setIsLevelEditorMode(true);
    
    // Clear the game entities when returning to editor
    if (gdlRuntimeRef.current) {
      gdlRuntimeRef.current.clearAllEntities();
    }
  };

  /**
   * Switch between default game and level editor
   */
  const toggleLevelEditor = async () => {
    try {
      console.log('GamePreview: Toggling level editor', { isLevelEditorMode, isPlayingCustomLevel });
      
      if (isLevelEditorMode || isPlayingCustomLevel) {
        // Returning to default game
        setIsLevelEditorMode(false);
        setIsPlayingCustomLevel(false);
        
        // Clear custom level and load default Mario scene
        if (gdlRuntimeRef.current && gameEngineRef.current) {
          try {
            gdlRuntimeRef.current.clearAllEntities();
            gameEngineRef.current.setCameraPosition(0, 0);
            await createMarioScene(gdlRuntimeRef.current);
            
            // Focus the canvas for input
            if (canvasRef.current) {
              canvasRef.current.focus();
            }
          } catch (error) {
            console.error("GamePreview: Error loading default scene", error);
          }
        }
      } else {
        // Entering level editor - clear current level
        console.log('GamePreview: Entering level editor mode');
        setIsLevelEditorMode(true);
        setIsPlayingCustomLevel(false);
        
        if (gdlRuntimeRef.current) {
          gdlRuntimeRef.current.clearAllEntities();
        }
        
        // Clear saved editor state when entering from default game
        // (but preserve it when returning from play mode)
        if (!isPlayingCustomLevel) {
          setSavedEditorState(null);
        }
      }
    } catch (error) {
      console.error('GamePreview: Error in toggleLevelEditor', error);
      // Reset to safe state
      setIsLevelEditorMode(false);
      setIsPlayingCustomLevel(false);
    }
  };

  return (
    <div className="relative w-full h-full">
      {/* Level Editor */}
      {isLevelEditorMode ? (
        <ErrorBoundary>
          <SimpleLevelEditor
            width={width}
            height={height}
            onPlayLevel={handlePlayCustomLevel}
            isPlaying={isPlayingCustomLevel}
            initialState={savedEditorState}
          />
        </ErrorBoundary>
      ) : (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="border border-gray-300 bg-sky-200"
          tabIndex={0}
          onClick={(e) => e.currentTarget.focus()}
          style={{ 
            imageRendering: 'pixelated',
            cursor: 'crosshair'
          }}
        />
      )}
      
      {/* Game State Display */}
      {!isLevelEditorMode && (
        <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-3 rounded text-sm font-mono">
          <div className="text-yellow-400 font-bold mb-1">
            {isPlayingCustomLevel ? 'CUSTOM LEVEL' : 'MARIO PLATFORMER'}
          </div>
          <div>Score: {gameState.score.toLocaleString()}</div>
          <div>Lives: {'❤️'.repeat(gameState.lives)}</div>
          <div>Coins: {gameState.coinsCollected}/{gameState.totalCoins}</div>
          <div>Level: {gameState.level}</div>
          <div className="border-t border-gray-600 mt-2 pt-2">
            <div>FPS: {fps}</div>
            <div>Entities: {entityCount}</div>
            <div className={`status-${gdlStatus} capitalize`}>
              GDL: {gdlStatus}
            </div>
          </div>
        </div>
      )}

      {/* Debug Info */}
      {showPerformance && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white p-2 rounded text-sm font-mono">
          {debugInfo.map((info, index) => (
            <div key={index}>{info}</div>
          ))}
        </div>
      )}

      {/* Controls */}
      {!isLevelEditorMode && (
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-75 text-white p-2 rounded text-sm">
          <div>Controls:</div>
          <div>A/D or ←/→ - Move</div>
          <div>Space - Jump</div>
          <div>P - Toggle Performance</div>
        </div>
      )}

      {/* Mode Toggle and Action Buttons */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-2">
        {/* Level Editor Toggle */}
        <button
          onClick={toggleLevelEditor}
          className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 font-bold"
        >
          {isLevelEditorMode ? 'Exit Editor' : 'Level Editor'}
        </button>
        
        {/* Return to Editor button when playing custom level */}
        {isPlayingCustomLevel && (
          <button
            onClick={handleReturnToEditor}
            className="px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700"
          >
            Back to Editor
          </button>
        )}
        
        {/* Test GDL Generation Buttons - only show in default mode */}
        {!isLevelEditorMode && !isPlayingCustomLevel && (
          <>
            <button
              onClick={() => generateTestGDL("Add a jumping enemy")}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Add Enemy
            </button>
            <button
              onClick={() => generateTestGDL("Add more coins")}
              className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
            >
              Add Coins
            </button>
            <button
              onClick={() => generateTestGDL("Add moving platform")}
              className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              Add Platform
            </button>
          </>
        )}
        
        <button
          onClick={() => setShowPerformance(!showPerformance)}
          className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
        >
          Debug
        </button>
      </div>

      <style jsx>{`
        .status-idle { color: #gray; }
        .status-executing { color: #yellow; }
        .status-success { color: #green; }
        .status-error { color: #red; }
      `}</style>
    </div>
  );
};

export default GamePreview;