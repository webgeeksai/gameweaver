import React, { useState, useRef, useEffect } from 'react';
import { Vector2 } from '../core/math/Vector2';
import { GDLRuntime } from '../gdl/runtime';

interface SpriteDefinition {
  type: string;
  name: string;
  sprite: string;
  defaultSize: { width: number; height: number };
  physics: 'static' | 'dynamic' | 'platformer';
  tags: string[];
  color: string; // For preview
}

interface PlacedSprite {
  id: string;
  definition: SpriteDefinition;
  position: Vector2;
  size: { width: number; height: number };
  rotation: number;
}

interface LevelEditorProps {
  width: number;
  height: number;
  onPlayLevel: (gdlCode: string) => void;
  isPlaying: boolean;
}

// Available sprites for the palette
const SPRITE_PALETTE: SpriteDefinition[] = [
  {
    type: 'player',
    name: 'Player',
    sprite: 'assets/player.svg',
    defaultSize: { width: 32, height: 48 },
    physics: 'platformer',
    tags: ['player'],
    color: '#e74c3c'
  },
  {
    type: 'ground',
    name: 'Ground',
    sprite: 'assets/ground.svg',
    defaultSize: { width: 200, height: 40 },
    physics: 'static',
    tags: ['ground', 'solid'],
    color: '#27ae60'
  },
  {
    type: 'platform',
    name: 'Platform',
    sprite: 'assets/platform.svg',
    defaultSize: { width: 120, height: 20 },
    physics: 'static',
    tags: ['platform', 'solid'],
    color: '#9b59b6'
  },
  {
    type: 'enemy',
    name: 'Goomba',
    sprite: 'assets/goomba.svg',
    defaultSize: { width: 28, height: 28 },
    physics: 'dynamic',
    tags: ['enemy', 'goomba'],
    color: '#8b4513'
  },
  {
    type: 'coin',
    name: 'Coin',
    sprite: 'assets/coin.svg',
    defaultSize: { width: 20, height: 20 },
    physics: 'static',
    tags: ['coin', 'collectible'],
    color: '#f1c40f'
  },
  {
    type: 'spike',
    name: 'Spike',
    sprite: 'assets/spike.svg',
    defaultSize: { width: 32, height: 32 },
    physics: 'static',
    tags: ['hazard', 'spike'],
    color: '#c0392b'
  },
  {
    type: 'spring',
    name: 'Spring',
    sprite: 'assets/spring.svg',
    defaultSize: { width: 32, height: 32 },
    physics: 'static',
    tags: ['spring', 'bouncy'],
    color: '#3498db'
  }
];

const LevelEditor: React.FC<LevelEditorProps> = ({ width, height, onPlayLevel, isPlaying }) => {
  console.log('LevelEditor: Component rendered', { width, height, isPlaying });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSprite, setSelectedSprite] = useState<SpriteDefinition | null>(SPRITE_PALETTE[0]);
  const [placedSprites, setPlacedSprites] = useState<PlacedSprite[]>([]);
  const [selectedPlacedSprite, setSelectedPlacedSprite] = useState<PlacedSprite | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };

    if (!isPlaying) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedPlacedSprite, placedSprites, isPlaying]);

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current && !canvasReady) {
      console.log('LevelEditor: Canvas initialized');
      setCanvasReady(true);
    }
  }, [canvasReady]);

  // Draw the level editor canvas
  useEffect(() => {
    if (!canvasRef.current || isPlaying || !canvasReady) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    console.log('LevelEditor: Drawing canvas', { width, height, placedSprites: placedSprites.length });

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    // Draw placed sprites
    placedSprites.forEach(sprite => {
      ctx.save();
      
      // Transform to sprite position
      ctx.translate(sprite.position.x, sprite.position.y);
      ctx.rotate(sprite.rotation);
      
      // Draw sprite rectangle
      ctx.fillStyle = sprite.definition.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(-sprite.size.width / 2, -sprite.size.height / 2, sprite.size.width, sprite.size.height);
      
      // Draw sprite name
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 1;
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sprite.definition.name, 0, 0);
      
      // Draw selection outline
      if (selectedPlacedSprite?.id === sprite.id) {
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.strokeRect(-sprite.size.width / 2 - 2, -sprite.size.height / 2 - 2, 
                      sprite.size.width + 4, sprite.size.height + 4);
      }
      
      ctx.restore();
    });

    // Draw placement preview
    if (selectedSprite && !selectedPlacedSprite && mousePos) {
      ctx.save();
      ctx.translate(mousePos.x, mousePos.y);
      ctx.fillStyle = selectedSprite.color;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-selectedSprite.defaultSize.width / 2, -selectedSprite.defaultSize.height / 2,
                  selectedSprite.defaultSize.width, selectedSprite.defaultSize.height);
      ctx.restore();
    }
  }, [placedSprites, selectedSprite, selectedPlacedSprite, showGrid, gridSize, width, height, isPlaying, mousePos, canvasReady]);

  const [mousePos, setMousePos] = useState<Vector2 | null>(null);

  const getMousePos = (e?: MouseEvent): Vector2 | null => {
    if (!canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const event = e || window.event as MouseEvent;
    if (!event) return null;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return new Vector2(x, y);
  };

  const snapPosition = (pos: Vector2): Vector2 => {
    if (!snapToGrid) return pos;
    return new Vector2(
      Math.round(pos.x / gridSize) * gridSize,
      Math.round(pos.y / gridSize) * gridSize
    );
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying || isDragging) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let pos = new Vector2(x, y);

    // Check if clicking on existing sprite
    const clickedSprite = placedSprites.find(sprite => {
      const halfWidth = sprite.size.width / 2;
      const halfHeight = sprite.size.height / 2;
      return x >= sprite.position.x - halfWidth && x <= sprite.position.x + halfWidth &&
             y >= sprite.position.y - halfHeight && y <= sprite.position.y + halfHeight;
    });

    if (clickedSprite) {
      setSelectedPlacedSprite(clickedSprite);
      setSelectedSprite(null);
    } else if (selectedSprite) {
      // Place new sprite
      pos = snapPosition(pos);
      const newSprite: PlacedSprite = {
        id: `sprite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        definition: selectedSprite,
        position: pos,
        size: { ...selectedSprite.defaultSize },
        rotation: 0
      };
      setPlacedSprites([...placedSprites, newSprite]);
    } else {
      setSelectedPlacedSprite(null);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPlaying || !selectedPlacedSprite) return;
    
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDragging(true);
    setDragOffset({
      x: x - selectedPlacedSprite.position.x,
      y: y - selectedPlacedSprite.position.y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const currentMousePos = new Vector2(x, y);
    
    // Update mouse position for preview
    setMousePos(currentMousePos);
    
    // Handle dragging
    if (!isDragging || !selectedPlacedSprite) return;
    
    let newPos = new Vector2(x - dragOffset.x, y - dragOffset.y);
    newPos = snapPosition(newPos);
    
    setPlacedSprites(placedSprites.map(sprite => 
      sprite.id === selectedPlacedSprite.id 
        ? { ...sprite, position: newPos }
        : sprite
    ));
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeleteSelected = () => {
    if (selectedPlacedSprite) {
      setPlacedSprites(placedSprites.filter(s => s.id !== selectedPlacedSprite.id));
      setSelectedPlacedSprite(null);
    }
  };

  const handleClearLevel = () => {
    if (confirm('Clear all sprites from the level?')) {
      setPlacedSprites([]);
      setSelectedPlacedSprite(null);
    }
  };

  const generateGDL = (): string => {
    let gdl = '// Level created with Level Editor\n\n';
    
    placedSprites.forEach((sprite, index) => {
      const entityName = `${sprite.definition.type}${index + 1}`;
      gdl += `entity ${entityName} {\n`;
      gdl += `  sprite: "${sprite.definition.sprite}"\n`;
      gdl += `  size: (${sprite.size.width}, ${sprite.size.height})\n`;
      gdl += `  position: (${sprite.position.x - width/2}, ${sprite.position.y - height/2})\n`;
      gdl += `  physics: "${sprite.definition.physics}"\n`;
      gdl += `  tags: [${sprite.definition.tags.map(t => `"${t}"`).join(', ')}]\n`;
      if (sprite.rotation !== 0) {
        gdl += `  rotation: ${sprite.rotation}\n`;
      }
      gdl += `}\n\n`;
    });
    
    return gdl;
  };

  const handlePlayLevel = () => {
    const gdl = generateGDL();
    onPlayLevel(gdl);
  };

  const handleSaveLevel = () => {
    const levelData = {
      sprites: placedSprites,
      metadata: {
        created: new Date().toISOString(),
        gridSize,
        canvasSize: { width, height }
      }
    };
    
    const blob = new Blob([JSON.stringify(levelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `level_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadLevel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const levelData = JSON.parse(e.target?.result as string);
        setPlacedSprites(levelData.sprites);
        if (levelData.metadata?.gridSize) {
          setGridSize(levelData.metadata.gridSize);
        }
      } catch (error) {
        console.error('Failed to load level:', error);
        alert('Failed to load level file');
      }
    };
    reader.readAsText(file);
  };

  if (isPlaying) {
    return null; // Hide editor when playing
  }

  return (
    <div className="flex h-full w-full bg-gray-900">
      {/* Left Panel - Sprite Palette */}
      <div className="w-48 bg-gray-800 p-4 overflow-y-auto">
        <h3 className="text-white font-bold mb-4">Sprite Palette</h3>
        <div className="space-y-2">
          {SPRITE_PALETTE.map(sprite => (
            <button
              key={sprite.type}
              onClick={() => {
                setSelectedSprite(sprite);
                setSelectedPlacedSprite(null);
              }}
              className={`w-full p-3 rounded text-white text-sm flex items-center space-x-2 hover:bg-gray-700 transition-colors ${
                selectedSprite?.type === sprite.type ? 'bg-blue-600' : 'bg-gray-700'
              }`}
            >
              <div 
                className="w-6 h-6 rounded"
                style={{ backgroundColor: sprite.color }}
              />
              <span>{sprite.name}</span>
            </button>
          ))}
        </div>

        {/* Grid Controls */}
        <div className="mt-6 space-y-3">
          <h4 className="text-white font-bold">Grid Settings</h4>
          <label className="flex items-center text-white text-sm">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="mr-2"
            />
            Show Grid
          </label>
          <label className="flex items-center text-white text-sm">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="mr-2"
            />
            Snap to Grid
          </label>
          <div className="text-white text-sm">
            <label>Grid Size:</label>
            <input
              type="number"
              value={gridSize}
              onChange={(e) => setGridSize(parseInt(e.target.value) || 20)}
              min="10"
              max="100"
              step="10"
              className="ml-2 w-16 px-2 py-1 bg-gray-700 rounded"
            />
          </div>
        </div>

        {/* Level Controls */}
        <div className="mt-6 space-y-2">
          <button
            onClick={handlePlayLevel}
            className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Play Level
          </button>
          <button
            onClick={handleClearLevel}
            className="w-full py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Level
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
      <div className="flex-1 flex flex-col relative bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="border-2 border-gray-600 cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />
        </div>
        
        {/* Instructions */}
        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white p-3 rounded text-sm">
          <div className="text-yellow-400 font-bold mb-2">LEVEL EDITOR</div>
          <div>Click to place sprites</div>
          <div>Click sprite to select</div>
          <div>Drag to move selected</div>
          <div>Delete key to remove</div>
        </div>

        {/* Status indicator */}
        <div className="absolute bottom-4 left-4 bg-green-600 bg-opacity-75 text-white px-3 py-1 rounded text-sm">
          Editor Ready - {placedSprites.length} sprites placed
        </div>
      </div>

      {/* Right Panel - Properties */}
      {selectedPlacedSprite && (
        <div className="w-64 bg-gray-800 p-4">
          <h3 className="text-white font-bold mb-4">Sprite Properties</h3>
          <div className="space-y-4 text-white text-sm">
            <div>
              <label>Type: {selectedPlacedSprite.definition.name}</label>
            </div>
            <div>
              <label>Position:</label>
              <div className="flex space-x-2 mt-1">
                <input
                  type="number"
                  value={Math.round(selectedPlacedSprite.position.x)}
                  onChange={(e) => {
                    const newX = parseInt(e.target.value) || 0;
                    setPlacedSprites(placedSprites.map(s =>
                      s.id === selectedPlacedSprite.id
                        ? { ...s, position: new Vector2(newX, s.position.y) }
                        : s
                    ));
                  }}
                  className="w-20 px-2 py-1 bg-gray-700 rounded"
                />
                <input
                  type="number"
                  value={Math.round(selectedPlacedSprite.position.y)}
                  onChange={(e) => {
                    const newY = parseInt(e.target.value) || 0;
                    setPlacedSprites(placedSprites.map(s =>
                      s.id === selectedPlacedSprite.id
                        ? { ...s, position: new Vector2(s.position.x, newY) }
                        : s
                    ));
                  }}
                  className="w-20 px-2 py-1 bg-gray-700 rounded"
                />
              </div>
            </div>
            <div>
              <label>Size:</label>
              <div className="flex space-x-2 mt-1">
                <input
                  type="number"
                  value={selectedPlacedSprite.size.width}
                  onChange={(e) => {
                    const newWidth = parseInt(e.target.value) || 32;
                    setPlacedSprites(placedSprites.map(s =>
                      s.id === selectedPlacedSprite.id
                        ? { ...s, size: { ...s.size, width: newWidth } }
                        : s
                    ));
                  }}
                  min="10"
                  className="w-20 px-2 py-1 bg-gray-700 rounded"
                />
                <input
                  type="number"
                  value={selectedPlacedSprite.size.height}
                  onChange={(e) => {
                    const newHeight = parseInt(e.target.value) || 32;
                    setPlacedSprites(placedSprites.map(s =>
                      s.id === selectedPlacedSprite.id
                        ? { ...s, size: { ...s.size, height: newHeight } }
                        : s
                    ));
                  }}
                  min="10"
                  className="w-20 px-2 py-1 bg-gray-700 rounded"
                />
              </div>
            </div>
            <div>
              <label>Rotation:</label>
              <input
                type="range"
                value={selectedPlacedSprite.rotation}
                onChange={(e) => {
                  const newRotation = parseFloat(e.target.value);
                  setPlacedSprites(placedSprites.map(s =>
                    s.id === selectedPlacedSprite.id
                      ? { ...s, rotation: newRotation }
                      : s
                  ));
                }}
                min="0"
                max={Math.PI * 2}
                step="0.1"
                className="w-full mt-1"
              />
              <span className="text-xs">
                {Math.round(selectedPlacedSprite.rotation * 180 / Math.PI)}°
              </span>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="w-full py-2 bg-red-600 rounded hover:bg-red-700"
            >
              Delete Sprite
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LevelEditor;