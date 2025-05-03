// frontend/src/components/ChatWindow.jsx
import React, { useEffect, useRef } from 'react';
import './ChatWindow.css'; // We'll create this CSS file

// Base URL for profile pics - Must match where auth-app serves them
// Ensure your auth-app/backend/server.js serves static files from '/uploads' correctly
const IMAGE_BASE_URL = 'http://localhost:5001/uploads/profile_pics';
const DEFAULT_AVATAR = '/default-avatar.png'; // Place a default avatar in frontend/public

function ChatWindow({ messages = [], currentUser }) {
    const messagesEndRef = useRef(null); // Ref to scroll to the bottom
    const prevMessagesLength = useRef(messages.length); // Track the previous length of messages to detect new messages

    // Function to scroll to the bottom of the messages list
    const scrollToBottom = () => {
        // Use smooth scrolling for better UX
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    // Scroll to bottom whenever the messages array changes
    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            scrollToBottom(); // Only scroll when new messages are added
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    // Ensure currentUser is loaded before rendering messages
    if (!currentUser) {
        return <div className="chat-window loading">Loading messages...</div>; // Or some loading indicator
    }

    // Helper to get avatar URL
    // Note: The 'message' object from the backend currently contains senderId, senderUserId, senderName.
    // It does NOT contain profile_pic_filename directly.
    // To show user-specific avatars:
    // 1. Include profile_pic_filename in the JWT payload (auth-app/routes/users.js)
    // 2. Include profile_pic_filename in the Message model (chat-app/models/Message.js) and populate it when saving.
    // 3. Fetch user profiles separately based on senderId/senderUserId.
    // For now, we'll use the default avatar for others.
    const getAvatarUrl = (message) => {
        if (message.profile_pic_filename) {
            return `${IMAGE_BASE_URL}/${message.profile_pic_filename}`;
        }
        return DEFAULT_AVATAR;
    };

    // Function to handle image loading errors
    const handleImageError = (e) => {
        // Prevent infinite loop if the default avatar itself fails
        if (e.target.src !== DEFAULT_AVATAR) {
            console.warn(`Failed to load avatar: ${e.target.src}. Falling back to default.`);
            e.target.onerror = null; // Remove handler to prevent loops
            e.target.src = DEFAULT_AVATAR;
        }
    };

    return (
        <div className="chat-window">
            <ul className="message-list">
                {messages.map((msg) => {
                    // Determine if the message is from the currently logged-in user
                    const isCurrentUser = msg.senderId === currentUser._id; // Compare MongoDB _id
                    const timestamp = msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--'; // Fallback if timestamp is missing

                    return (
                        <li
                            key={msg._id || `msg-${Math.random()}`} // Use _id from DB, fallback for unsaved messages if any
                            className={`message-item ${isCurrentUser ? 'my-message' : 'other-message'}`}
                        >
                            {/* Conditionally render avatar for non-current users if desired */}
                            {!isCurrentUser && (
                                <img
                                    src={getAvatarUrl(msg)}
                                    alt={`${msg.senderName || 'User'}'s avatar`}
                                    className="message-avatar"
                                    onError={handleImageError} // Handle image load errors
                                />
                            )}
                            <div className="message-content">
                                {/* Show sender name only for messages from others */}
                                {!isCurrentUser && (
                                    <span className="message-sender">{msg.senderName || msg.senderUserId || 'Unknown User'}</span>
                                )}
                                <p className="message-text">{msg.text}</p>
                                <span className="message-timestamp">{timestamp}</span>
                            </div>
                            {/* Conditionally render avatar for current user on the right if desired */}
                            {/* {isCurrentUser && <img src={getAvatarUrl(msg)} ... />} */}
                        </li>
                    );
                })}
                 {/* Empty div at the end used as a target for scrolling */}
                 <div ref={messagesEndRef} style={{ height: '1px' }} />
            </ul>

        </div>
    );
}

export default ChatWindow;