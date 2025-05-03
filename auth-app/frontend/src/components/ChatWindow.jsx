import React, { useEffect, useRef } from 'react';
import './ChatWindow.css';

const IMAGE_BASE_URL = 'http://localhost:5001/uploads/profile_pics';
const DEFAULT_AVATAR = '/default-avatar.png';

const logComparison = (msg, currentUser, componentId) => {
    console.log(
        `[${componentId}] Comparing msg ID ${msg?._id}:`,
        `\n  msg.senderId: ${msg?.senderId} (Type: ${typeof msg?.senderId})`,
        `\n  currentUser._id: ${currentUser?._id} (Type: ${typeof currentUser?._id})`,
        `\n  Comparison Result (===): ${msg?.senderId === currentUser?._id}`
    );
};

function ChatWindow({ messages = [], currentUser }) {
    const messagesEndRef = useRef(null);
    const prevMessagesLength = useRef(messages.length);
    const instanceId = useRef(`ChatWindow-${Math.random().toString(36).substring(2, 7)}`).current;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            scrollToBottom();
        }
        prevMessagesLength.current = messages.length;
    }, [messages]);

    useEffect(() => {
        console.log(`[${instanceId}] currentUser prop updated:`, currentUser?._id);
    }, [currentUser, instanceId]);

    if (!currentUser) {
        console.log(`[${instanceId}] Rendering loading state (currentUser is null/undefined)`);
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
            console.warn(`[${instanceId}] Failed to load avatar: ${e.target.src}. Falling back to default.`);
            e.target.onerror = null;
            e.target.src = DEFAULT_AVATAR;
        }
    };

    console.log(`[${instanceId}] Rendering ChatWindow with ${messages.length} messages. Current User ID: ${currentUser._id}`);

    return (
        <div className="chat-window">
            <ul className="message-list">
                {messages.map((msg, index) => {
                    logComparison(msg, currentUser, instanceId);

                    const isCurrentUser = msg.senderId === currentUser._id;
                    const timestamp = msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '--:--';

                    return (
                        <li
                            key={msg._id || `msg-temp-${index}-${Date.now()}`}
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