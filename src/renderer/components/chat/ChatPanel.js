import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useEffect } from 'react';
import { useChatStore } from '../../state/chatState';
import Message from './Message';
import MessageInput from './MessageInput';
export default function ChatPanel({ onSendMessage, onPause }) {
    const { messages, isStreaming, isPaused } = useChatStore();
    const messagesEndRef = useRef(null);
    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderLeft: '1px solid #e0e0e0',
            background: 'white',
        }, children: [_jsxs("div", { style: {
                    padding: '16px',
                    borderBottom: '1px solid #e0e0e0',
                    fontWeight: 600,
                    fontSize: '16px',
                    background: '#fafafa',
                }, children: ["Chat", isStreaming && (_jsx("span", { style: {
                            marginLeft: '8px',
                            fontSize: '12px',
                            color: '#666',
                            fontWeight: 400,
                        }, children: isPaused ? '⏸ Paused' : '⏳ Streaming...' }))] }), _jsx("div", { style: {
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                }, children: messages.length === 0 ? (_jsx("div", { style: {
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        color: '#999',
                        padding: '20px',
                    }, children: _jsxs("div", { children: [_jsx("div", { style: { fontSize: '36px', marginBottom: '12px' }, children: "\uD83D\uDCAC" }), _jsx("div", { style: { fontSize: '14px' }, children: "Start a conversation to build your workflow" }), _jsx("div", { style: { fontSize: '12px', marginTop: '8px' }, children: "Try: \"Add a KSampler node\" or \"Connect these nodes\"" })] }) })) : (_jsxs(_Fragment, { children: [messages.map((message) => (_jsx(Message, { message: message }, message.id))), _jsx("div", { ref: messagesEndRef })] })) }), _jsx("div", { style: {
                    padding: '16px',
                    borderTop: '1px solid #e0e0e0',
                    background: '#fafafa',
                }, children: _jsx(MessageInput, { onSend: onSendMessage, onPause: onPause, isStreaming: isStreaming, isPaused: isPaused }) })] }));
}
