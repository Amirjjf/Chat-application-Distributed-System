// frontend/src/components/ChatWindow.jsx
import React, { useEffect, useRef } from 'react';
import './ChatWindow.css';

const IMAGE_BASE_URL = 'http://localhost:5001/uploads/profile_pics';
const DEFAULT_AVATAR = '/default-avatar.png';

function ChatWindow({ messages = [], currentUser }) {
    const messagesEndRef = useRef(null);
    const prevMessagesLength = useRef(messages.length);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    if (!currentUser) {
        return <div className="chat-window loading">Loading messages...</div>;
    }

    const getAvatarUrl = (message) => {
        if (message.profile_pic_filename) {
            return `${IMAGE_BASE_URL}/${message.profile_pic_filename}`;
        }
        return DEFAULT_AVATAR;
    };

    const handleImageError = (e) => {
        if (e.target.src !== DEFAULT_AVATAR) {
            console.warn(`Failed to load avatar: ${e.target.src}. Falling back to default.`);
            e.target.onerror = null;
            e.target.src = DEFAULT_AVATAR;
        }
    };

    return (
        <div className="chat-window">
            <ul className="message-list">
                {messages.map((msg) => {
                    const isCurrentUser = msg.senderId === currentUser._id;
                    const timestamp = msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--';

                    return (
                        <li
                            key={msg._id || `msg-${Math.random()}`}
                            className={`message-item ${isCurrentUser ? 'my-message' : 'other-message'}`}
                        >
                            {!isCurrentUser && (
                                <img
                                    src={getAvatarUrl(msg)}
                                    alt={`${msg.senderName || 'User'}'s avatar`}
                                    className="message-avatar"
                                    onError={handleImageError}
                                />
                            )}
                            <div className="message-content">
                                {!isCurrentUser && (
                                    <span className="message-sender">{msg.senderName || msg.senderUserId || 'Unknown User'}</span>
                                )}
                                <p className="message-text">{msg.text}</p>
                                <span className="message-timestamp">{timestamp}</span>
                            </div>
                        </li>
                    );
                })}
                <div ref={messagesEndRef} style={{ height: '1px' }} />
            </ul>
        </div>
    );
}

export default ChatWindow;