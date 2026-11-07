import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Message({ message }) {
    const isUser = message.role === 'user';
    return (_jsx("div", { style: {
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '12px',
        }, children: _jsxs("div", { style: {
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: isUser ? '#1a73e8' : '#f0f0f0',
                color: isUser ? 'white' : '#333',
                fontSize: '14px',
                lineHeight: '1.5',
            }, children: [_jsx("div", { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: message.content }), message.toolCalls && message.toolCalls.length > 0 && (_jsx("div", { style: {
                        marginTop: '8px',
                        paddingTop: '8px',
                        borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.3)' : '#ddd'}`,
                        fontSize: '12px',
                        opacity: 0.9,
                    }, children: message.toolCalls.map((tool) => (_jsxs("div", { style: { marginTop: '4px' }, children: ["\uD83D\uDD27 ", tool.name, tool.status === 'pending' && ' ⏳', tool.status === 'success' && ' ✓', tool.status === 'error' && ` ✗ ${tool.error || 'Error'}`] }, tool.id))) })), _jsx("div", { style: {
                        fontSize: '10px',
                        marginTop: '6px',
                        opacity: 0.7,
                        textAlign: 'right',
                    }, children: new Date(message.timestamp).toLocaleTimeString() })] }) }));
}
