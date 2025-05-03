// frontend/src/components/MessageInput.jsx
import React, { useState } from 'react';
import './MessageInput.css'; // We'll create this CSS file

function MessageInput({ onSendMessage, disabled }) {
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault(); // Prevent default form submission which reloads page
        const trimmedText = text.trim();
        if (trimmedText && !disabled) { // Ensure text exists and connection is enabled
            onSendMessage(trimmedText); // Call the callback function passed from ChatPage
            setText(''); // Clear the input field after sending
        }
    };

    const handleInputChange = (e) => {
        setText(e.target.value);
    };

    // Allow sending message by pressing Enter key
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for newline (if using textarea)
            e.preventDefault(); // Prevent newline in input/textarea
            handleSubmit(e); // Trigger form submission logic
        }
    };


    return (
        <form onSubmit={handleSubmit} className="message-input-form">
            <input
                type="text"
                placeholder={disabled ? "Connecting..." : "Type your message here..."}
                value={text}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress} // Handle Enter key press
                disabled={disabled} // Disable input if WebSocket is not connected
                autoComplete="off" // Prevent browser autocomplete suggestions
                aria-label="Chat message input"
            />
            <button
                type="submit"
                disabled={disabled || !text.trim()} // Disable button if disconnected or input is empty/whitespace
                aria-label="Send chat message"
            >
                Send
            </button>
        </form>
    );
}

export default MessageInput;