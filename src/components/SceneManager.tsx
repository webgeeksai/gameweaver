import React, { useState } from 'react';
import { Layers, Plus, Trash2, Eye, EyeOff, Edit } from 'lucide-react';

interface Scene {
  id: string;
  name: string;
  active: boolean;
  entityCount: number;
}

interface SceneManagerProps {
  scenes: Scene[];
  activeScene?: string;
  onSelectScene: (sceneId: string) => void;
  onCreateScene: () => void;
  onDeleteScene: (sceneId: string) => void;
  onToggleSceneVisibility: (sceneId: string) => void;
}

const SceneManager: React.FC<SceneManagerProps> = ({
  scenes,
  activeScene,
  onSelectScene,
  onCreateScene,
  onDeleteScene,
  onToggleSceneVisibility
}) => {
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  const handleEditStart = (scene: Scene) => {
    setEditingSceneId(scene.id);
    setEditingName(scene.name);
  };
  
  const handleEditSave = () => {
    // In a real implementation, this would save the name change
    setEditingSceneId(null);
  };
  
  const handleEditCancel = () => {
    setEditingSceneId(null);
  };
  
  return (
    <div className="border rounded-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg flex items-center">
          <Layers className="mr-2" size={18} />
          Scenes
        </h3>
        
        <button 
          className="p-1 text-gray-500 hover:text-indigo-600 rounded"
          title="Create New Scene"
          onClick={onCreateScene}
        >
          <Plus size={18} />
        </button>
      </div>
      
      {scenes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No scenes created yet</p>
          <button 
            className="mt-2 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition text-sm"
            onClick={onCreateScene}
          >
            Create First Scene
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {scenes.map(scene => (
            <li 
              key={scene.id}
              className={`border rounded-lg p-2 ${
                scene.id === activeScene ? 'border-indigo-500 bg-indigo-50' : ''
              }`}
            >
              <div className="flex justify-between items-center">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => onSelectScene(scene.id)}
                >
                  {editingSceneId === scene.id ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-full"
                        autoFocus
                        onBlur={handleEditSave}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="font-medium">{scene.name}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({scene.entityCount} entities)
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-1">
                  <button 
                    className="p-1 text-gray-500 hover:text-gray-700 rounded"
                    title={scene.active ? "Hide Scene" : "Show Scene"}
                    onClick={() => onToggleSceneVisibility(scene.id)}
                  >
                    {scene.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button 
                    className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                    title="Edit Scene Name"
                    onClick={() => handleEditStart(scene)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="p-1 text-gray-500 hover:text-red-500 rounded"
                    title="Delete Scene"
                    onClick={() => onDeleteScene(scene.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SceneManager;