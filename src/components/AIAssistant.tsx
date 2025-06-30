import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Sparkles, Loader } from 'lucide-react';
import { AIProcessor } from '../ai/AIProcessor';
import { GDLCompiler } from '../gdl/compiler';

interface AIAssistantProps {
  onCodeGenerated?: (code: string) => void;
  onEntityCreated?: (entity: any) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ 
  onCodeGenerated,
  onEntityCreated
}) => {
  const [messages, setMessages] = useState<any[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Welcome to Game Vibe Engine! I\'m powered by Claude 4 Sonnet. Describe the game you want to create, and I\'ll help you build it.',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Initialize AI processor
  const aiProcessorRef = useRef<AIProcessor>(new AIProcessor());
  const gdlCompilerRef = useRef<GDLCompiler>(new GDLCompiler());
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    
    // Generate initial suggestions
    const initialSuggestions = aiProcessorRef.current.generateSuggestions();
    setSuggestions(initialSuggestions);
  }, []);
  
  const handleSendMessage = async () => {
    if (input.trim() === '' || isProcessing) return;
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      // Process the input
      const aiProcessor = aiProcessorRef.current;
      const gdlCompiler = gdlCompilerRef.current;
      
      // Process the input to generate GDL code
      const command = await aiProcessor.processInput(input);
      
      // Compile the GDL code
      const compilationResult = await gdlCompiler.compile(command.gdlCode);
      
      // Create result object
      const result = {
        success: compilationResult.success,
        code: compilationResult.code,
        errors: compilationResult.errors,
        warnings: compilationResult.warnings
      };
      
      // Update context
      aiProcessor.updateContext(command, result);
      
      // Generate response message
      let responseContent = '';
      
      if (result.success) {
        responseContent = `I've created the ${command.type.toLowerCase().replace('_', ' ')} you requested. Here's the GDL code:
\`\`\`gdl
${command.gdlCode}
\`\`\``;
        
        // Notify parent component
        if (onCodeGenerated && result.code) {
          onCodeGenerated(result.code);
        }
        
        // Notify about entity creation
        if (command.type === 'CREATE_ENTITY' && onEntityCreated) {
          onEntityCreated({
            type: command.parameters.entityType,
            name: command.parameters.name || command.parameters.entityType,
            position: command.parameters.position
          });
        }
      } else {
        responseContent = `I had trouble with that request. ${result.errors?.[0]?.message || 'Something went wrong.'}`;
      }
      
      // Add assistant message
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: Date.now(),
        command,
        result
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update suggestions
      const newSuggestions = aiProcessor.generateSuggestions();
      setSuggestions(newSuggestions);
      
    } catch (error) {
      // Handle error
      console.error('AI processing error:', error);
      
      // Try to recover
      let errorMessage = 'Sorry, I encountered an error processing your request.';
      let recoverySuggestions: string[] = [];
      
      try {
        const recovery = aiProcessorRef.current.handleError(error, aiProcessorRef.current.getContext());
        errorMessage = recovery.message;
        recoverySuggestions = recovery.suggestions || [];
      } catch (recoveryError) {
        console.error('Error recovery failed:', recoveryError);
      }
      
      // Add error message
      const errorResponse = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now(),
        error: true,
        suggestions: recoverySuggestions
      };
      
      setMessages(prev => [...prev, errorResponse]);
      setSuggestions(recoverySuggestions);
      
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };
  
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white">
      <div className="bg-indigo-700 text-white p-3 flex items-center">
        <Bot className="mr-2" size={20} />
        <h3 className="font-semibold">Game Development Assistant</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white border shadow-sm rounded-tl-none'
              }`}
            >
              <div className="flex items-center mb-1">
                {message.role === 'assistant' ? (
                  <Bot size={16} className="mr-1" />
                ) : (
                  <User size={16} className="mr-1" />
                )}
                <span className="text-xs opacity-75">
                  {message.role === 'user' ? 'You' : 'Assistant'} • {formatTime(message.timestamp)}
                </span>
              </div>
              <div className="whitespace-pre-wrap prose prose-sm max-w-none">
                {message.content.split('```').map((part: string, i: number) => {
                  if (i % 2 === 0) {
                    return <span key={i}>{part}</span>;
                  } else {
                    const [language, ...codeParts] = part.split('\n');
                    const code = codeParts.join('\n');
                    return (
                      <pre key={i} className="bg-gray-800 text-white p-2 rounded-md overflow-x-auto">
                        <code>{code}</code>
                      </pre>
                    );
                  }
                })}
              </div>
              
              {message.error && message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Suggestions:</p>
                  <ul className="list-disc pl-5 mt-1">
                    {message.suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="cursor-pointer hover:underline" onClick={() => handleSuggestionClick(suggestion)}>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {suggestions.length > 0 && (
        <div className="px-3 py-2 border-t border-b bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion, index) => (
              <button
                key={index}
                className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-full hover:bg-gray-100 transition-colors flex items-center"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                <Sparkles size={12} className="mr-1 text-indigo-500" />
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div className="border-t p-3 bg-white">
        <div className="flex items-end">
          <textarea
            ref={inputRef}
            className="flex-1 p-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Describe what you want to add to your game..."
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
          />
          <button
            className={`ml-2 p-2 rounded-full ${
              isProcessing || input.trim() === ''
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
            onClick={handleSendMessage}
            disabled={isProcessing || input.trim() === ''}
          >
            {isProcessing ? <Loader className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>
        {isProcessing && (
          <div className="text-xs text-gray-500 mt-1">
            Processing your request...
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAssistant;