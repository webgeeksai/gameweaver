import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector2 } from '../core/math/Vector2';

interface LevelEditorProps {
  width: number;
  height: number;
  onPlayLevel: (gdlCode: string, editorState: any) => void;
  isPlaying: boolean;
  initialState?: any;
}

interface SpriteType {
  type: string;
  name: string;
  color: string;
  size: { width: number; height: number };
  physics: 'static' | 'dynamic' | 'platformer';
  tags: string[];
}

interface PlacedSprite {
  id: string;
  type: SpriteType;
  x: number;
  y: number;
}

const SPRITES: SpriteType[] = [
  { type: 'player', name: 'Player', color: '#e74c3c', size: { width: 32, height: 48 }, physics: 'platformer', tags: ['player'] },
  { type: 'ground', name: 'Ground', color: '#27ae60', size: { width: 200, height: 40 }, physics: 'static', tags: ['ground', 'solid'] },
  { type: 'platform', name: 'Platform', color: '#9b59b6', size: { width: 120, height: 20 }, physics: 'static', tags: ['platform', 'solid'] },
  { type: 'enemy', name: 'Enemy', color: '#8b4513', size: { width: 28, height: 28 }, physics: 'dynamic', tags: ['enemy'] },
  { type: 'coin', name: 'Coin', color: '#f1c40f', size: { width: 20, height: 20 }, physics: 'static', tags: ['coin', 'collectible'] }
];

const SimpleLevelEditor: React.FC<LevelEditorProps> = ({ width, height, onPlayLevel, isPlaying, initialState }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSprite, setSelectedSprite] = useState<SpriteType>(initialState?.selectedSprite || SPRITES[0]);
  const [placedSprites, setPlacedSprites] = useState<PlacedSprite[]>(initialState?.placedSprites || []);
  const [selectedPlaced, setSelectedPlaced] = useState<PlacedSprite | null>(initialState?.selectedPlaced || null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#2c3e50';
      ctx.fillRect(0, 0, width, height);

      // Draw grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw placed sprites
      placedSprites.forEach(sprite => {
        // Validate sprite data
        if (!sprite || !sprite.type || typeof sprite.x !== 'number' || typeof sprite.y !== 'number') {
          console.warn('Invalid sprite data:', sprite);
          return;
        }

        const spriteType = sprite.type;
        const color = spriteType.color || '#3498db'; // Default blue color
        const size = spriteType.size || { width: 32, height: 32 }; // Default size
        const name = spriteType.name || 'Unknown'; // Default name

        ctx.fillStyle = color;
        ctx.fillRect(
          sprite.x - size.width / 2,
          sprite.y - size.height / 2,
          size.width,
          size.height
        );

        // Draw name
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(name, sprite.x, sprite.y);

        // Draw selection outline
        if (selectedPlaced?.id === sprite.id) {
          ctx.strokeStyle = '#3498db';
          ctx.lineWidth = 2;
          ctx.strokeRect(
            sprite.x - size.width / 2 - 2,
            sprite.y - size.height / 2 - 2,
            size.width + 4,
            size.height + 4
          );
        }
      });
    } catch (error) {
      console.error('Canvas drawing error:', error);
    }
  }, [width, height, placedSprites, selectedPlaced]);

  useEffect(() => {
    if (!isPlaying) {
      drawCanvas();
    }
  }, [drawCanvas, isPlaying]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on existing sprite
    const clickedSprite = placedSprites.find(sprite => {
      // Validate sprite data
      if (!sprite || !sprite.type || typeof sprite.x !== 'number' || typeof sprite.y !== 'number') {
        return false;
      }
      
      const size = sprite.type.size || { width: 32, height: 32 };
      const halfWidth = size.width / 2;
      const halfHeight = size.height / 2;
      return x >= sprite.x - halfWidth && x <= sprite.x + halfWidth &&
             y >= sprite.y - halfHeight && y <= sprite.y + halfHeight;
    });

    if (clickedSprite) {
      setSelectedPlaced(clickedSprite);
    } else {
      // Place new sprite
      const newSprite: PlacedSprite = {
        id: `sprite_${Date.now()}`,
        type: selectedSprite,
        x: Math.round(x / 20) * 20,
        y: Math.round(y / 20) * 20
      };
      setPlacedSprites(prev => [...prev, newSprite]);
      setSelectedPlaced(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPlaced) {
      setPlacedSprites(prev => prev.filter(s => s.id !== selectedPlaced.id));
      setSelectedPlaced(null);
    }
  };

  const handleClear = () => {
    if (confirm('Clear all sprites?')) {
      setPlacedSprites([]);
      setSelectedPlaced(null);
    }
  };

  const generateGDL = () => {
    let gdl = '// Generated Level\n\n';
    placedSprites.forEach((sprite, index) => {
      // Validate sprite data
      if (!sprite || !sprite.type || typeof sprite.x !== 'number' || typeof sprite.y !== 'number') {
        console.warn('Skipping invalid sprite in GDL generation:', sprite);
        return;
      }

      const spriteType = sprite.type;
      const entityName = `${spriteType.type || 'unknown'}${index + 1}`;
      const size = spriteType.size || { width: 32, height: 32 };
      const physics = spriteType.physics || 'static';
      const tags = spriteType.tags || [];

      // Convert screen coordinates to world coordinates
      // Screen: (0,0) is top-left, (800,600) is bottom-right
      // World: (0,0) is center, negative Y is up, positive Y is down
      const worldX = sprite.x - width/2;  // Convert to world X
      const worldY = sprite.y - height/2; // Convert to world Y
      
      console.log(`GDL: Converting sprite ${spriteType.type} from screen(${sprite.x}, ${sprite.y}) to world(${worldX}, ${worldY})`);
      
      gdl += `entity ${entityName} {\n`;
      gdl += `  sprite: "assets/${spriteType.type || 'unknown'}.svg"\n`;
      gdl += `  size: (${size.width}, ${size.height})\n`;
      gdl += `  position: (${worldX}, ${worldY})\n`;
      gdl += `  physics: "${physics}"\n`;
      gdl += `  tags: [${tags.map(t => `"${t}"`).join(', ')}]\n`;
      gdl += `}\n\n`;
    });
    return gdl;
  };

  const handlePlay = () => {
    try {
      console.log('SimpleLevelEditor: Playing level with sprites:', placedSprites);
      const gdl = generateGDL();
      console.log('SimpleLevelEditor: Generated GDL:', gdl);
      
      if (!gdl || gdl.trim() === '// Generated Level\n\n') {
        console.warn('SimpleLevelEditor: No sprites to play - GDL is empty');
        setStatusMessage('No sprites placed! Add some sprites first.');
        setTimeout(() => setStatusMessage(''), 3000);
        return;
      }
      
      const editorState = {
        selectedSprite,
        placedSprites,
        selectedPlaced
      };
      console.log('SimpleLevelEditor: Calling onPlayLevel with state:', editorState);
      onPlayLevel(gdl, editorState);
    } catch (error) {
      console.error('Error generating GDL:', error);
      setStatusMessage('Error generating level');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleSaveLevel = () => {
    try {
      const levelData = {
        sprites: placedSprites,
        metadata: {
          created: new Date().toISOString(),
          canvasSize: { width, height },
          spriteCount: placedSprites.length
        }
      };
      
      const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `level_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      setStatusMessage('Level saved successfully!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('Error saving level:', error);
      setStatusMessage('Failed to save level');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const handleLoadLevel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const levelData = JSON.parse(e.target?.result as string);
          if (levelData.sprites && Array.isArray(levelData.sprites)) {
            // Validate and fix sprite data
            const validSprites: PlacedSprite[] = [];
            
            levelData.sprites.forEach((sprite: any, index: number) => {
              try {
                // Check if sprite has required properties
                if (!sprite || typeof sprite.x !== 'number' || typeof sprite.y !== 'number') {
                  console.warn(`Skipping invalid sprite at index ${index}:`, sprite);
                  return;
                }

                let spriteType: SpriteType;
                
                // Handle different sprite data formats
                if (sprite.type && sprite.type.type) {
                  // New format with full type object
                  spriteType = sprite.type;
                } else if (sprite.definition) {
                  // Original LevelEditor format
                  spriteType = {
                    type: sprite.definition.type,
                    name: sprite.definition.name,
                    color: sprite.definition.color,
                    size: sprite.definition.defaultSize || sprite.size || { width: 32, height: 32 },
                    physics: sprite.definition.physics || 'static',
                    tags: sprite.definition.tags || []
                  };
                } else {
                  // Try to find matching sprite type
                  const matchingSprite = SPRITES.find(s => s.type === sprite.type || s.name === sprite.type);
                  if (matchingSprite) {
                    spriteType = matchingSprite;
                  } else {
                    console.warn(`Unknown sprite type: ${sprite.type}, using default`);
                    spriteType = SPRITES[0]; // Default to first sprite
                  }
                }

                const validSprite: PlacedSprite = {
                  id: sprite.id || `sprite_${Date.now()}_${index}`,
                  type: spriteType,
                  x: sprite.x || sprite.position?.x || 0,
                  y: sprite.y || sprite.position?.y || 0
                };

                validSprites.push(validSprite);
              } catch (error) {
                console.warn(`Error processing sprite at index ${index}:`, error);
              }
            });

            setPlacedSprites(validSprites);
            setSelectedPlaced(null);
            setStatusMessage(`Level loaded: ${validSprites.length} sprites`);
            setTimeout(() => setStatusMessage(''), 3000);
            console.log('Level loaded successfully:', { 
              original: levelData.sprites.length, 
              loaded: validSprites.length,
              metadata: levelData.metadata 
            });
          } else {
            throw new Error('Invalid level file format: missing sprites array');
          }
        } catch (error) {
          console.error('Error parsing level file:', error);
          setStatusMessage('Failed to load level: Invalid format');
          setTimeout(() => setStatusMessage(''), 3000);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error loading level:', error);
      alert('Failed to load level file');
    }
    
    // Reset file input
    e.target.value = '';
  };

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedPlaced) {
        handleDeleteSelected();
      }
    };

    if (!isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedPlaced, isPlaying]);

  if (isPlaying) {
    return null;
  }

  return (
    <div className="flex h-full w-full bg-gray-900">
      {/* Left Panel */}
      <div className="w-48 bg-gray-800 p-4">
        <h3 className="text-white font-bold mb-4">Sprites</h3>
        <div className="space-y-2">
          {SPRITES.map(sprite => (
            <button
              key={sprite.type}
              onClick={() => setSelectedSprite(sprite)}
              className={`w-full p-2 rounded text-white text-sm flex items-center space-x-2 ${
                selectedSprite.type === sprite.type ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: sprite.color }}
              />
              <span>{sprite.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={handlePlay}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Play Level
          </button>
          <button
            onClick={handleClear}
            className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear All
          </button>
          <button
            onClick={handleSaveLevel}
            className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Level
          </button>
          <label className="block w-full py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-center cursor-pointer">
            Load Level
            <input
              type="file"
              accept=".json"
              onChange={handleLoadLevel}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border-2 border-gray-600 cursor-crosshair"
            onClick={handleCanvasClick}
          />
          
          {/* Instructions */}
          <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white p-2 rounded text-sm">
            <div className="text-yellow-400 font-bold">LEVEL EDITOR</div>
            <div>Click to place: {selectedSprite.name}</div>
            <div>Sprites: {placedSprites.length}</div>
            {statusMessage && (
              <div className="text-green-400 mt-1 font-bold">{statusMessage}</div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      {selectedPlaced && selectedPlaced.type && (
        <div className="w-48 bg-gray-800 p-4">
          <h3 className="text-white font-bold mb-4">Selected</h3>
          <div className="text-white text-sm space-y-2">
            <div>Type: {selectedPlaced.type.name || 'Unknown'}</div>
            <div>Position: ({Math.round(selectedPlaced.x)}, {Math.round(selectedPlaced.y)})</div>
            <div>Size: {selectedPlaced.type.size?.width || 32} x {selectedPlaced.type.size?.height || 32}</div>
            <button
              onClick={handleDeleteSelected}
              className="w-full py-2 bg-red-600 rounded hover:bg-red-700 text-white"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleLevelEditor;