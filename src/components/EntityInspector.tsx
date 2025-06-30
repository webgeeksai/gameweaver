import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import { Entity } from '../core/ecs/Entity';
import { ComponentType } from '../core/types';
import { ComponentManager } from '../core/ecs/ComponentManager';

interface EntityInspectorProps {
  entity?: Entity;
  componentManager?: ComponentManager;
  onUpdateEntity?: (entity: Entity, updates: any) => void;
}

const EntityInspector: React.FC<EntityInspectorProps> = ({
  entity,
  componentManager,
  onUpdateEntity
}) => {
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set([ComponentType.Transform]));
  
  if (!entity || !componentManager) {
    return (
      <div className="border rounded-lg p-4 h-full flex items-center justify-center text-gray-500">
        <p>Select an entity to inspect</p>
      </div>
    );
  }
  
  const toggleComponent = (type: string) => {
    setExpandedComponents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };
  
  const updateComponentData = (componentType: string, key: string, value: any) => {
    if (!entity || !componentManager || !onUpdateEntity) return;
    
    const component = componentManager.getByEntity(entity, componentType as ComponentType);
    if (component) {
      const newData = { ...component.data };
      
      // Handle nested properties
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        newData[parent] = { ...newData[parent], [child]: value };
      } else {
        newData[key] = value;
      }
      
      onUpdateEntity(entity, { componentType, data: newData });
    }
  };
  
  const renderComponentData = (componentType: string, data: any) => {
    if (!data) return null;
    
    return (
      <div className="pl-2 space-y-1">
        {Object.entries(data).map(([key, value]) => {
          // Skip functions and complex objects
          if (typeof value === 'function' || (typeof value === 'object' && value !== null && !Array.isArray(value) && !(key === 'position' || key === 'scale'))) {
            return null;
          }
          
          // Handle position and scale objects
          if ((key === 'position' || key === 'scale') && typeof value === 'object' && value !== null) {
            return (
              <div key={key} className="ml-2">
                <span className="text-gray-700">{key}:</span>
                <div className="flex space-x-2 mt-1">
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 mr-1">x:</span>
                    <input
                      type="number"
                      className="w-16 p-1 text-xs border rounded"
                      value={(value as any).x}
                      onChange={(e) => updateComponentData(componentType, `${key}.x`, parseFloat(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 mr-1">y:</span>
                    <input
                      type="number"
                      className="w-16 p-1 text-xs border rounded"
                      value={(value as any).y}
                      onChange={(e) => updateComponentData(componentType, `${key}.y`, parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            );
          }
          
          // Handle arrays
          if (Array.isArray(value)) {
            return (
              <div key={key} className="ml-2">
                <span className="text-gray-700">{key}: [{value.join(', ')}]</span>
              </div>
            );
          }
          
          // Handle primitive values
          return (
            <div key={key} className="ml-2 flex items-center">
              <span className="text-gray-700 mr-2">{key}:</span>
              {typeof value === 'boolean' ? (
                <input
                  type="checkbox"
                  checked={value as boolean}
                  onChange={(e) => updateComponentData(componentType, key, e.target.checked)}
                  className="mr-2"
                />
              ) : typeof value === 'number' ? (
                <input
                  type="number"
                  value={value as number}
                  onChange={(e) => updateComponentData(componentType, key, parseFloat(e.target.value))}
                  className="w-20 p-1 text-xs border rounded"
                />
              ) : (
                <input
                  type="text"
                  value={value as string}
                  onChange={(e) => updateComponentData(componentType, key, e.target.value)}
                  className="w-32 p-1 text-xs border rounded"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="border rounded-lg p-4 h-full overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg flex items-center">
          <Settings className="mr-2" size={18} />
          Entity Inspector
        </h3>
        
        <div className="flex space-x-2">
          <button 
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
            title={entity.active ? "Deactivate Entity" : "Activate Entity"}
          >
            {entity.active ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button 
            className="p-1 text-gray-500 hover:text-red-500 rounded"
            title="Delete Entity"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      {/* Entity Header */}
      <div className="mb-4">
        <div className="flex items-center">
          <span className="font-medium mr-2">Name:</span>
          <span>{entity.name}</span>
        </div>
        <div className="flex items-center mt-1">
          <span className="font-medium mr-2">ID:</span>
          <span className="text-xs text-gray-500">{entity.id}</span>
        </div>
        <div className="flex items-center mt-1">
          <span className="font-medium mr-2">Tags:</span>
          <div className="flex flex-wrap gap-1">
            {Array.from(entity.tags).map(tag => (
              <span key={tag} className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      
      {/* Components */}
      <div className="space-y-2">
        <h4 className="font-medium">Components</h4>
        
        {Array.from(entity.components.entries()).map(([type, id]) => {
          const component = componentManager.get(id);
          const isExpanded = expandedComponents.has(type);
          
          return (
            <div key={type} className="border rounded-lg overflow-hidden">
              <div 
                className="flex justify-between items-center p-2 bg-gray-100 cursor-pointer"
                onClick={() => toggleComponent(type)}
              >
                <span className="font-medium">{type}</span>
                <span className="text-xs">{isExpanded ? '▼' : '►'}</span>
              </div>
              
              {isExpanded && component && (
                <div className="p-2 text-sm">
                  {renderComponentData(type, component.data)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Custom Properties */}
      <div className="mt-4">
        <h4 className="font-medium mb-2">Custom Properties</h4>
        
        {Object.keys(entity.properties).length === 0 ? (
          <p className="text-sm text-gray-500">No custom properties</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(entity.properties).map(([key, value]) => (
              <div key={key} className="flex items-center">
                <span className="text-gray-700 mr-2">{key}:</span>
                <span>{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityInspector;