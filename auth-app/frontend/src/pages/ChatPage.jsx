import React, { useState, useEffect, useRef, useCallback } from 'react';
import authApi from '../services/authApi';
import ChatWindow from '../components/ChatWindow';
import MessageInput from '../components/MessageInput';
import { useNavigate } from 'react-router-dom';
import './ChatPage.css';

const CHAT_APP_WS_URL = 'ws://localhost:5002';

function ChatPage() {
    const [messages, setMessages] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState('');
    const ws = useRef(null);
    const isUnmounting = useRef(false);
    const navigate = useNavigate();

    const connectWebSocket = useCallback((token) => {
        if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
            console.log('Closing existing WebSocket connection before reconnecting.');
            ws.current.onclose = null;
            ws.current.close(1000, 'Client initiated reconnect');
        }

        console.log('Attempting to connect to WebSocket...');
        setError('');

        ws.current = new WebSocket(`${CHAT_APP_WS_URL}?token=${encodeURIComponent(token)}`);

        ws.current.onopen = () => {
            console.log('WebSocket Connected Successfully');
            setIsConnected(true);
            setError('');
        };

        ws.current.onclose = (event) => {
            const currentNavigate = navigate;
            const reason = event.reason || 'No reason specified';
            console.log(`WebSocket Disconnected - Code: ${event.code}, Reason: ${reason}, WasClean: ${event.wasClean}`);
            setIsConnected(false);

            if (isUnmounting.current) {
                console.log('Skipping reconnect/redirect as component is unmounting.');
                return;
            }

            if (event.code === 1008 || event.code === 4001) {
                setError(`Authentication failed: ${reason}. Please log in again.`);
                authApi.logout();
                currentNavigate('/login');
            } else if (event.code === 1000 || event.code === 1001 || event.code === 1005) {
                 setError('Disconnected.');
            } else {
                setError(`Connection lost unexpectedly (Code: ${event.code}). Reconnect or refresh needed.`);
                console.warn("Automatic reconnect disabled in this example to prevent potential loops. Please refresh or implement robust reconnect logic.");
            }
        };

        ws.current.onerror = (err) => {
            console.error('WebSocket Error:', err);
            setError('WebSocket connection error occurred. Check console.');
            setIsConnected(false);
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Message received:', data);

                switch (data.type) {
                    case 'history':
                        setMessages(Array.isArray(data.payload) ? data.payload : []);
                        break;
                    case 'newMessage':
                        if (data.payload && typeof data.payload === 'object' && data.payload._id && data.payload.senderId) {
                            setMessages(prev => {
                                if (prev.some(msg => msg._id === data.payload._id)) {
                                    return prev;
                                }
                                return [...prev, data.payload];
                            });
                        } else {
                            console.warn('Received invalid newMessage payload structure:', data.payload);
                        }
                        break;
                    case 'error':
                        console.error('Server error message:', data.payload);
                        setError(`Server error: ${data.payload}`);
                        break;
                    default:
                        console.warn('Unknown message type received:', data.type);
                }
            } catch (e) {
                console.error('Failed to parse message or update state:', e, 'Raw data:', event.data);
                setError('Received an invalid message from the server.');
            }
        };

    }, [navigate]);

    useEffect(() => {
        isUnmounting.current = false;
        const user = authApi.getCurrentUser();
        const token = authApi.getToken();

        if (!user || !token) {
            console.log('No current user or token found on mount, redirecting to login.');
            authApi.logout();
            navigate('/login');
            return;
        }

        connectWebSocket(token);

        return () => {
            isUnmounting.current = true;
            if (ws.current) {
                console.log('ChatPage unmounting. Closing WebSocket connection.');
                ws.current.onopen = null;
                ws.current.onmessage = null;
                ws.current.onerror = null;
                ws.current.onclose = () => console.log('WebSocket closed due to component unmount.');
                if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
                     ws.current.close(1000, 'Client component unmounted');
                 }
                 ws.current = null;
            }
        };
    }, [navigate, connectWebSocket]);

    const sendMessage = (text) => {
        const trimmedText = text?.trim();
        if (!trimmedText) return;

        if (ws.current?.readyState === WebSocket.OPEN) {
            try {
                const message = { type: 'chatMessage', payload: { text: trimmedText } };
                ws.current.send(JSON.stringify(message));
                console.log('Message sent:', message);
            } catch (e) {
                console.error('Failed to send message:', e);
                setError('Failed to send message. Connection might be closed.');
            }
        } else {
            setError('Cannot send message: Not connected to the chat server.');
            console.warn('Attempted to send message while WebSocket was not open.', ws.current?.readyState);
        }
    };

    const currentUser = authApi.getCurrentUser();

    if (!currentUser) {
        console.log("ChatPage rendering check: No current user, showing loading/redirecting state.");
        return <div className="page-container"><p>Loading user information or redirecting...</p></div>;
    }

    return (
        <div className="chat-page">
            <header className="chat-header">
                <h2>Global Chat Room</h2>
                <div className="connection-info">
                    <span>Status: </span>
                    <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                </div>
                <span className="current-user-info">
                    Logged in as: {currentUser.name} ({currentUser.user_id})
                </span>
            </header>

            {error && <p className="error-message chat-error">{error}</p>}

            <ChatWindow messages={messages} currentUser={currentUser} />

            <MessageInput onSendMessage={sendMessage} disabled={!isConnected} />
        </div>
    );
}

export default ChatPage;