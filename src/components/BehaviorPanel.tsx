import React, { useState } from 'react';
import { Code, Plus, Trash2, Edit } from 'lucide-react';

interface Behavior {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface BehaviorPanelProps {
  behaviors: Behavior[];
  onAddBehavior: (behaviorId: string, entityId?: string) => void;
  onEditBehavior: (behaviorId: string) => void;
  onDeleteBehavior: (behaviorId: string) => void;
}

const BehaviorPanel: React.FC<BehaviorPanelProps> = ({
  behaviors,
  onAddBehavior,
  onEditBehavior,
  onDeleteBehavior
}) => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const categories = ['Movement', 'AI', 'Physics', 'Input', 'Visual', 'Audio'];
  
  const filteredBehaviors = behaviors.filter(behavior => {
    // Apply category filter
    if (filter !== 'all' && behavior.category !== filter) {
      return false;
    }
    
    // Apply search filter
    if (searchTerm && !behavior.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });
  
  return (
    <div className="border rounded-lg p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg flex items-center">
          <Code className="mr-2" size={18} />
          Behaviors
        </h3>
        
        <button 
          className="p-1 text-gray-500 hover:text-indigo-600 rounded flex items-center"
          title="Create New Behavior"
          onClick={() => onAddBehavior('new')}
        >
          <Plus size={18} />
          <span className="ml-1 text-sm">Create</span>
        </button>
      </div>
      
      <div className="mb-4 flex space-x-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search behaviors..."
            className="w-full p-2 border rounded-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="p-2 border rounded-md"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
      
      {filteredBehaviors.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
          <Plus size={24} className="mb-2" />
          <p className="mb-1">No behaviors found</p>
          <p className="text-sm">Create a behavior to get started</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredBehaviors.map(behavior => (
            <div 
              key={behavior.id}
              className="border rounded-lg p-3 hover:border-indigo-500 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{behavior.name}</div>
                  <div className="text-sm text-gray-500 mt-1">{behavior.description}</div>
                  <div className="mt-2">
                    <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                      {behavior.category}
                    </span>
                  </div>
                </div>
                
                <div className="flex space-x-1">
                  <button 
                    className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                    title="Add to Entity"
                    onClick={() => onAddBehavior(behavior.id)}
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                    title="Edit Behavior"
                    onClick={() => onEditBehavior(behavior.id)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="p-1 text-gray-500 hover:text-red-500 rounded"
                    title="Delete Behavior"
                    onClick={() => onDeleteBehavior(behavior.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BehaviorPanel;