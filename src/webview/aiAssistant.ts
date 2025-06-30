// This file will be compiled to out/webview/aiAssistant.js

declare const acquireVsCodeApi: any;

const vscode = acquireVsCodeApi();

interface Message {
    id: string;
    type: 'user' | 'assistant' | 'error';
    content: string;
    timestamp: Date;
    code?: string;
}

class AIAssistantWebview {
    private messages: Message[] = [];
    private isWaitingForResponse = false;
    private messageContainer?: HTMLElement;
    private messageInput?: HTMLTextAreaElement;
    private sendButton?: HTMLButtonElement;

    constructor() {
        this.initializeUI();
        this.setupEventListeners();
        this.setupMessageHandling();
        this.showWelcomeMessage();
    }

    private initializeUI() {
        this.messageContainer = document.getElementById('chat-messages');
        this.messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
        this.sendButton = document.getElementById('send-btn') as HTMLButtonElement;
    }

    private setupEventListeners() {
        // Send button
        this.sendButton?.addEventListener('click', () => this.sendMessage());

        // Enter key to send (Shift+Enter for new line)
        this.messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput?.addEventListener('input', () => {
            if (this.messageInput) {
                this.messageInput.style.height = 'auto';
                this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
            }
        });

        // Example prompt buttons
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('example-prompt')) {
                const promptText = target.textContent || '';
                if (this.messageInput) {
                    this.messageInput.value = promptText;
                    this.messageInput.focus();
                }
            }
        });
    }

    private setupMessageHandling() {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'response':
                    this.handleAssistantResponse(message.message, message.code);
                    break;
                case 'error':
                    this.handleError(message.message);
                    break;
                case 'context':
                    this.handleContextUpdate(message.context);
                    break;
            }
        });
    }

    private sendMessage() {
        if (!this.messageInput || this.isWaitingForResponse) return;

        const content = this.messageInput.value.trim();
        if (!content) return;

        // Add user message
        this.addMessage('user', content);
        
        // Clear input
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Send to extension
        this.sendToExtension('sendMessage', { message: content });
        
        // Show typing indicator
        this.showTypingIndicator();
        this.isWaitingForResponse = true;
        this.updateSendButton();
    }

    private addMessage(type: 'user' | 'assistant' | 'error', content: string, code?: string) {
        const message: Message = {
            id: Date.now().toString(),
            type,
            content,
            timestamp: new Date(),
            code
        };

        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    private renderMessage(message: Message) {
        if (!this.messageContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.type}`;
        messageElement.setAttribute('data-message-id', message.id);

        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';

        // Format content
        let formattedContent = message.content;
        
        // Simple markdown-like formatting
        formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        contentElement.innerHTML = formattedContent;

        messageElement.appendChild(contentElement);

        // Add code block if present
        if (message.code) {
            const codeElement = document.createElement('div');
            codeElement.className = 'code-block';
            codeElement.textContent = message.code;
            messageElement.appendChild(codeElement);
        }

        this.messageContainer.appendChild(messageElement);
    }

    private handleAssistantResponse(content: string, code?: string) {
        this.hideTypingIndicator();
        this.addMessage('assistant', content, code);
        this.isWaitingForResponse = false;
        this.updateSendButton();
        
        // Focus input for next message
        this.messageInput?.focus();
    }

    private handleError(content: string) {
        this.hideTypingIndicator();
        this.addMessage('error', content);
        this.isWaitingForResponse = false;
        this.updateSendButton();
    }

    private handleContextUpdate(context: any) {
        console.log('Context updated:', context);
        // Could update UI based on context
    }

    private showTypingIndicator() {
        if (!this.messageContainer) return;

        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.id = 'typing-indicator';
        typingElement.innerHTML = `
            <span>AI is thinking</span>
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;

        this.messageContainer.appendChild(typingElement);
        this.scrollToBottom();
    }

    private hideTypingIndicator() {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.remove();
        }
    }

    private updateSendButton() {
        if (this.sendButton) {
            this.sendButton.disabled = this.isWaitingForResponse;
            this.sendButton.textContent = this.isWaitingForResponse ? 'Thinking...' : 'Send';
        }
    }

    private scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }

    private showWelcomeMessage() {
        if (!this.messageContainer) return;

        const welcomeElement = document.createElement('div');
        welcomeElement.className = 'welcome-message';
        welcomeElement.innerHTML = `
            <h4>Welcome to AI Game Assistant!</h4>
            <p>I can help you create games using natural language. Try one of these examples:</p>
            <div class="example-prompts">
                <div class="example-prompt">Create a player that can jump and move left/right</div>
                <div class="example-prompt">Add an enemy that moves back and forth</div>
                <div class="example-prompt">Make a platform at position x:300, y:400</div>
                <div class="example-prompt">Add a collectible coin that sparkles</div>
                <div class="example-prompt">Create a simple Mario-style platformer</div>
            </div>
        `;

        this.messageContainer.appendChild(welcomeElement);
    }

    private sendToExtension(type: string, data: any) {
        vscode.postMessage({
            type,
            ...data
        });
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AIAssistantWebview());
} else {
    new AIAssistantWebview();
}