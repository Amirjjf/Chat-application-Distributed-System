// frontend/src/components/MessageInput.jsx
import React, { useState } from 'react';
import './MessageInput.css';

function MessageInput({ onSendMessage, disabled }) {
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedText = text.trim();
        if (trimmedText && !disabled) {
            onSendMessage(trimmedText);
            setText('');
        }
    };

    const handleInputChange = (e) => {
        setText(e.target.value);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="message-input-form">
            <input
                type="text"
                placeholder={disabled ? "Connecting..." : "Type your message here..."}
                value={text}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                disabled={disabled}
                autoComplete="off"
                aria-label="Chat message input"
            />
            <button
                type="submit"
                disabled={disabled || !text.trim()}
                aria-label="Send chat message"
            >
                Send
            </button>
        </form>
    );
}

export default MessageInput;