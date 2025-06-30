import React, { useState, useEffect, useRef } from 'react';
import { GDLCompiler } from '../gdl/compiler';

interface GDLEditorProps {
  initialCode?: string;
  onCompile?: (result: any) => void;
}

const GDLEditor: React.FC<GDLEditorProps> = ({ 
  initialCode = defaultGDLCode,
  onCompile
}) => {
  const [code, setCode] = useState(initialCode);
  const [compiledCode, setCompiledCode] = useState('');
  const [errors, setErrors] = useState<any[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const compiler = useRef(new GDLCompiler());
  
  // Compile code when it changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      compileCode();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [code]);
  
  const compileCode = async () => {
    setIsCompiling(true);
    
    try {
      const result = await compiler.current.compile(code);
      
      if (result.success) {
        setCompiledCode(result.code || '');
        setErrors([]);
      } else {
        setErrors(result.errors || []);
      }
      
      if (onCompile) {
        onCompile(result);
      }
    } catch (error) {
      setErrors([{ message: `Unexpected error: ${error.message}` }]);
    } finally {
      setIsCompiling(false);
    }
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">GDL Editor</h3>
        <button 
          className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition"
          onClick={compileCode}
          disabled={isCompiling}
        >
          {isCompiling ? 'Compiling...' : 'Compile'}
        </button>
      </div>
      
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* GDL Code Editor */}
        <div className="border rounded-lg overflow-hidden">
          <textarea
            className="w-full h-full p-4 font-mono text-sm bg-gray-50 resize-none focus:outline-none"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck={false}
          />
        </div>
        
        {/* Compiled TypeScript */}
        <div className="border rounded-lg overflow-hidden">
          <pre className="w-full h-full p-4 font-mono text-sm bg-gray-50 overflow-auto">
            {compiledCode || 'Compiled code will appear here...'}
          </pre>
        </div>
      </div>
      
      {/* Error display */}
      {errors.length > 0 && (
        <div className="mt-4 border border-red-300 rounded-lg bg-red-50 p-4">
          <h4 className="font-semibold text-red-700 mb-2">Compilation Errors:</h4>
          <ul className="list-disc pl-5 text-red-600">
            {errors.map((error, index) => (
              <li key={index}>
                {error.message}
                {error.location && ` (Line ${error.location.start?.line}, Column ${error.location.start?.column})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// Default GDL code for the editor
const defaultGDLCode = `// Game Configuration
game {
  title: "My Awesome Game"
  size: [800, 600]
  scale: fit
  defaultScene: MainScene
  physics: arcade
  pixelArt: true
}

// Player Entity
entity Player {
  sprite: "player.png"
  size: [32, 48]
  physics: platformer
  behaviors: [Moveable, Jumpable]
  
  properties: {
    health: 100
    speed: 200
    jumpPower: 400
  }
}

// Enemy Entity
entity Enemy {
  sprite: "enemy.png"
  size: [32, 32]
  physics: dynamic
  behaviors: [PatrolAI]
  
  properties: {
    health: 50
    damage: 10
    patrolDistance: 100
  }
}

// Moveable Behavior
behavior Moveable {
  properties: {
    speed: 200
    acceleration: 10
  }
  
  update: {
    // Movement logic
  }
}

// Jumpable Behavior
behavior Jumpable {
  properties: {
    jumpPower: 400
    maxJumps: 2
  }
  
  methods: {
    jump: {
      // Jump logic
    }
  }
}

// Main Scene
scene MainScene {
  size: [1600, 600]
  camera: follow(player)
  
  spawn Player at [100, 400] as player
  spawn Enemy at [400, 400] as enemy1
  
  when start: {
    // Scene initialization
  }
}`;

export default GDLEditor;