// 导入 API 配置
import { API_BASE_URL } from '../../../config.js';

// Web Component: 聊天图标组件
class ChatIconComponent extends HTMLElement {
    constructor() {
        super();
        this.isOpen = false;
        this.contentLoaded = false;
        this.init();
    }

    connectedCallback() {
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        this.innerHTML = `
            <style>
                /* 聊天图标样式 */
                .chat-icon {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    width: 60px;
                    height: 60px;
                    background: #007bff;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
                    transition: all 0.3s ease;
                    z-index: 1000;
                }

                .chat-icon:hover {
                    transform: scale(1.1);
                    box-shadow: 0 6px 16px rgba(0, 123, 255, 0.4);
                }

                .chat-icon img {
                    width: 30px;
                    height: 30px;
                    filter: brightness(0) invert(1);
                }

                /* 聊天窗口样式 */
                .chat-window {
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    width: 400px;
                    height: 500px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
                    z-index: 1001;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    animation: slideIn 0.3s ease;
                }

                .chat-window.show {
                    display: flex;
                }

                /* 聊天窗口头部 */
                .chat-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px 20px;
                    background: #007bff;
                    color: white;
                    border-radius: 12px 12px 0 0;
                }

                .chat-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s ease;
                }

                .close-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }

                /* 聊天内容区域 */
                .chat-content {
                    flex: 1;
                    padding: 0;
                    overflow: hidden;
                    background: #f8f9fa;
                    display: flex;
                    flex-direction: column;
                }

                /* 消息容器 */
                .messages-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                /* 欢迎消息 */
                .welcome-message {
                    text-align: center;
                    color: #6c757d;
                    font-style: italic;
                    margin-bottom: 20px;
                }

                .welcome-message p {
                    margin: 5px 0;
                }

                /* 消息样式 */
                .message {
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 18px;
                    word-wrap: break-word;
                }

                .user-message {
                    background: #007bff;
                    color: white;
                    align-self: flex-end;
                    margin-left: auto;
                }

                .bot-message {
                    background: white;
                    color: #333;
                    align-self: flex-start;
                    border: 1px solid #e9ecef;
                    margin-right: auto;
                }

                .message-content {
                    font-size: 14px;
                    line-height: 1.4;
                }

                .message-time {
                    font-size: 11px;
                    opacity: 0.7;
                    margin-top: 4px;
                }

                /* 输入容器 */
                .input-container {
                    display: flex;
                    padding: 16px;
                    background: white;
                    border-top: 1px solid #e9ecef;
                    gap: 8px;
                }

                #chat-input {
                    flex: 1;
                    padding: 12px 16px;
                    border: 1px solid #e9ecef;
                    border-radius: 20px;
                    outline: none;
                    font-size: 14px;
                }

                #chat-input:focus {
                    border-color: #007bff;
                    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
                }

                #send-btn {
                    padding: 12px 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: background 0.2s;
                }

                #send-btn:hover {
                    background: #0056b3;
                }

                #send-btn:disabled {
                    background: #6c757d;
                    cursor: not-allowed;
                }

                /* 正在输入动画 */
                .typing-message {
                    opacity: 0.7;
                }

                .typing-dots {
                    display: inline-block;
                }

                .typing-dots span {
                    display: inline-block;
                    animation: typing 1.4s infinite;
                    animation-delay: calc(var(--i) * 0.2s);
                }

                .typing-dots span:nth-child(1) { --i: 0; }
                .typing-dots span:nth-child(2) { --i: 1; }
                .typing-dots span:nth-child(3) { --i: 2; }

                @keyframes typing {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.5;
                    }
                    30% {
                        transform: translateY(-10px);
                        opacity: 1;
                    }
                }

                /* 加载状态 */
                .loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #6c757d;
                    font-size: 14px;
                }

                /* 滑入动画 */
                @keyframes slideIn {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                /* 响应式设计 */
                @media (max-width: 768px) {
                    .chat-window {
                        width: 90vw;
                        height: 70vh;
                        bottom: 10px;
                        right: 5vw;
                    }
                    
                    .chat-icon {
                        width: 50px;
                        height: 50px;
                        bottom: 15px;
                        right: 15px;
                    }
                }
            </style>
            <div class="chat-icon" id="chat-icon">
                <img src="./src/assets/pics/bubble-chat.png" alt="Chat" />
            </div>
            <div class="chat-window" id="chat-window">
                <div class="chat-header">
                    <h3>Chat with Moolaegis</h3>
                    <button class="close-btn" id="close-chat">x</button>
                </div>
                <div class="chat-content" id="chat-content">
                    <div class="loading">Loading chat...</div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const chatIcon = this.querySelector('#chat-icon');
        const closeBtn = this.querySelector('#close-chat');
        const chatWindow = this.querySelector('#chat-window');

        if (chatIcon) {
            chatIcon.addEventListener('click', () => this.toggleChat());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeChat());
        }

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.contains(e.target)) {
                this.closeChat();
            }
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        const chatWindow = this.querySelector('#chat-window');
        if (chatWindow) {
            chatWindow.classList.add('show');
            this.isOpen = true;
            
            if (!this.contentLoaded) {
                this.loadChatContent();
            }
        }
    }

    closeChat() {
        const chatWindow = this.querySelector('#chat-window');
        if (chatWindow) {
            chatWindow.classList.remove('show');
            this.isOpen = false;
        }
    }

    loadChatContent() {
        const contentArea = this.querySelector('#chat-content');
        if (!contentArea) return;

        // 直接创建聊天界面
        contentArea.innerHTML = `
            <div class="messages-container" id="messages">
                <div class="welcome-message">
                    <p>Welcome to Moolaegis Chat!</p>
                    <p>How can I help you today?</p>
                </div>
            </div>
            <div class="input-container">
                <input type="text" id="chat-input" placeholder="Type your message..." />
                <button id="send-btn">Send</button>
            </div>
        `;

        // 绑定聊天事件
        this.bindChatEvents();
        this.contentLoaded = true;
    }

    bindChatEvents() {
        const sendBtn = this.querySelector('#send-btn');
        const chatInput = this.querySelector('#chat-input');

        if (sendBtn && chatInput) {
            sendBtn.addEventListener('click', () => this.sendMessage());
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    async sendMessage() {
        const chatInput = this.querySelector('#chat-input');
        const messagesContainer = this.querySelector('#messages');
        
        if (!chatInput || !messagesContainer) return;

        const message = chatInput.value.trim();
        if (!message) return;

        // 添加用户消息
        this.addMessage('user', message);
        chatInput.value = '';

        // 显示正在输入状态
        const typingMessage = this.addTypingMessage();

        try {
            // 获取机器人回复
            const botResponse = await this.getBotResponse(message);
            
            // 移除正在输入状态
            this.removeTypingMessage(typingMessage);
            
            // 添加机器人回复
            this.addMessage('bot', botResponse);
            
        } catch (error) {
            console.error('Error getting bot response:', error);
            
            // 移除正在输入状态
            this.removeTypingMessage(typingMessage);
            
            // 显示错误消息
            this.addMessage('bot', 'Sorry, I encountered an error. Please try again.');
        }
    }
    /*
    addMessage(sender, text) {
        const messagesContainer = this.querySelector('#messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        messageDiv.innerHTML = `
            <div class="message-content">${text}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    */
    addMessage(sender, text) {
        const messagesContainer = this.querySelector('#messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        // 如果是機器人訊息，用 marked() 轉換 markdown → HTML
        const renderedContent = sender === 'bot' ? marked.parse(text) : text;

        messageDiv.innerHTML = `
            <div class="message-content">${renderedContent}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }


    addTypingMessage() {
        const messagesContainer = this.querySelector('#messages');
        if (!messagesContainer) return null;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-message';
        typingDiv.innerHTML = `
            <div class="message-content">
                <span class="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                </span>
            </div>
        `;

        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        return typingDiv;
    }

    removeTypingMessage(typingMessage) {
        if (typingMessage && typingMessage.parentNode) {
            typingMessage.parentNode.removeChild(typingMessage);
        }
    }

    async getBotResponse(userMessage) {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
                'accept': 'application/json'
            },
            body: JSON.stringify({ message: userMessage })
        });
        const data = await response.json();
        return data.reply;
    }
}

// 注册自定义元素
customElements.define('chat-icon', ChatIconComponent);

// 导出类（可选）
export { ChatIconComponent };