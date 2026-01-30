import { useState, useRef, useEffect } from 'react';
import { nodeCategories } from './nodes/nodeDefinitions';
import { getNodeTooltip } from './nodes/tooltips';
import { getLayoutedElements } from '../../utils/autoLayout';

// System prompt for Grok to understand AutoTouch
const SYSTEM_PROMPT = `Bạn là AI Assistant giúp người dùng tạo script AutoTouch trên iOS. Bạn hiểu rất rõ các hàm AutoTouch Lua và giúp tạo workflow tự động hóa.

DANH SÁCH NODE CÓ THỂ DÙNG:
- startNode: Điểm bắt đầu kịch bản
- ifNode: Kiểm tra điều kiện (chỉ có 1 output)
- ifElseNode: Rẽ nhánh if/else (2 outputs: true/false)
- whileNode: Vòng lặp while (2 outputs: body/next)
- forNode: Vòng lặp for i=1,n (2 outputs: body/next)
- forEachNode: Duyệt mảng k,v in pairs() (2 outputs: body/next)
- breakNode: Thoát vòng lặp
- stopNode: Dừng kịch bản
- tapNode: Chạm vào tọa độ x,y
- swipeNode: Vuốt từ x1,y1 đến x2,y2
- longPressNode: Nhấn giữ tại x,y trong duration ms
- findColorNode: Tìm màu, lưu vào biến (có options: debug, rightToLeft, bottomToTop)
- findColorsNode: Tìm nhiều màu pattern
- findImageNode: Tìm hình ảnh, lưu vào biến (có options: debug, method)
- getColorNode: Lấy màu tại x,y
- screenshotNode: Chụp màn hình
- appRunNode: Mở ứng dụng bằng bundle ID
- appKillNode: Đóng ứng dụng
- waitNode: Chờ N mili giây
- logNode: Ghi log
- alertNode: Hiện thông báo
- openUrlNode: Mở URL trong Safari
- ocrNode: Đọc chữ OCR (có options: debug, correct, method, languages)
- inputTextNode: Nhập văn bản vào ô input (cần tap vào ô trước)
- setVariableNode: Đặt biến
- commentNode: Ghi chú

QUAN TRỌNG - CÁCH TRẢ LỜI:
Khi user mô tả workflow, bạn phải trả lời dạng JSON để tạo nodes tự động. Format:
{
  "message": "Giải thích ngắn gọn workflow",
  "nodes": [
    {"type": "startNode", "data": {}},
    {"type": "openUrlNode", "data": {"url": "https://google.com"}},
    {"type": "waitNode", "data": {"duration": 3000}},
    {"type": "tapNode", "data": {"x": 200, "y": 300, "count": 1}}, // Click ô tìm kiếm
    {"type": "waitNode", "data": {"duration": 1000}},
    {"type": "inputTextNode", "data": {"text": "từ khóa tìm kiếm"}}, // Nhập text
    {"type": "tapNode", "data": {"x": 350, "y": 600}}, // Click nút Search
  ],
  "explanation": "Giải thích chi tiết từng bước và cách nối"
}

Nếu user hỏi câu hỏi thông thường (không phải tạo workflow), trả lời text bình thường KHÔNG có JSON.

VÍ DỤ LOGIC PHỔ BIẾN:
1. Tìm kiếm Google: openUrlNode → waitNode → tapNode (vào ô input) → inputTextNode (nhập từ khóa) → tapNode (nút Enter/Search)
2. Cuộn trang: swipeNode với y1 > y2 (vuốt lên) hoặc y1 < y2 (vuốt xuống)
3. Lặp lại N lần: forNode → [body: các action] → [next: tiếp tục]
4. Click ngẫu nhiên: tapNode với tọa độ random (dùng math.random)
5. Tìm và click: findImageNode → ifElseNode → tapNode (true branch)

Trả lời bằng tiếng Việt, ngắn gọn và dễ hiểu.`;

// Parse AI response for nodes
function parseAIResponse(response) {
    try {
        // 1. Extract JSON part (support markdown code blocks too)
        let jsonString = response;
        const jsonMatch = response.match(/\{[\s\S]*"nodes"[\s\S]*\}/);

        if (jsonMatch) {
            jsonString = jsonMatch[0];
        }

        // 2. Clean JSON (Remove comments //... )
        // Regex to remove comments but keep http:// urls safe
        const cleanJson = jsonString.replace(/("[^"]*")|(\/\/.*)/g, (m, group1) => {
            if (group1) return group1; // Preserve strings
            return ""; // Remove comments
        });

        const parsed = JSON.parse(cleanJson);
        return {
            type: 'workflow',
            message: parsed.message || 'Đây là workflow gợi ý:',
            nodes: parsed.nodes || [],
            explanation: parsed.explanation || '',
        };
    } catch (e) {
        console.error("JSON Parse Error:", e);
        // Not JSON or parse error, return as text
    }

    return {
        type: 'text',
        message: response,
        nodes: [],
    };
}

function AIAssistant({ nodes: currentNodes, setNodes, setEdges, reactFlowInstance }) {
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: '👋 Chào bạn! Mình là **Grok AI** - trợ lý tạo script AutoTouch.\n\n🤖 **Bạn có thể:**\n• Mô tả workflow (ví dụ: "mở url google.com rồi cuộn 5 vòng")\n• Yêu cầu tạo script (ví dụ: "lặp 10 lần click vào vị trí 100,200")\n• Hỏi về cách dùng AutoTouch\n\n💡 Mình sẽ tự động tạo nodes VÀ kết nối chúng cho bạn!',
        },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-insert nodes into canvas WITH automatic layout
    const handleInsertNodes = (nodesToInsert) => {
        if (!nodesToInsert || nodesToInsert.length === 0) return;
        if (!setNodes) return;

        const timestamp = Date.now();

        // 1. Check existing nodes
        const hasExistingNodes = currentNodes && currentNodes.length > 0;
        let finalNodesToInsert = [...nodesToInsert];

        // 2. Remove 'startNode' if one already exists
        if (hasExistingNodes) {
            finalNodesToInsert = finalNodesToInsert.filter(n => n.type !== 'startNode');
        }

        if (finalNodesToInsert.length === 0) return;

        // 3. Find the last node to connect to (if exists)
        let lastExistingNode = null;
        if (hasExistingNodes) {
            lastExistingNode = currentNodes[currentNodes.length - 1];
        }

        // Create temporary nodes without position first
        let newNodes = finalNodesToInsert.map((nodeConfig, index) => ({
            id: `${nodeConfig.type}-${timestamp}-${index}`,
            type: nodeConfig.type,
            position: { x: 0, y: 0 },
            data: nodeConfig.data || {},
        }));

        // Create edges to connect new nodes sequentially
        const newEdges = [];
        for (let i = 0; i < newNodes.length - 1; i++) {
            const sourceNode = newNodes[i];
            const targetNode = newNodes[i + 1];

            // Determine source handle based on node type
            let sourceHandle = undefined;
            if (['forNode', 'whileNode', 'forEachNode'].includes(sourceNode.type)) {
                sourceHandle = 'body';
            } else if (sourceNode.type === 'ifElseNode') {
                sourceHandle = 'true';
            }

            newEdges.push({
                id: `edge-${timestamp}-${i}`,
                source: sourceNode.id,
                target: targetNode.id,
                sourceHandle: sourceHandle,
                animated: true,
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
            });
        }

        // 4. Connect the FIRST new node to the LAST existing node
        if (lastExistingNode) {
            let lastSourceHandle = undefined;
            if (['forNode', 'whileNode', 'forEachNode'].includes(lastExistingNode.type)) {
                lastSourceHandle = 'body';
            } else if (lastExistingNode.type === 'ifElseNode') {
                lastSourceHandle = 'true';
            }

            newEdges.push({
                id: `edge-connect-${timestamp}`,
                source: lastExistingNode.id,
                target: newNodes[0].id,
                sourceHandle: lastSourceHandle,
                animated: true,
                style: { stroke: '#8b5cf6', strokeWidth: 2 },
            });
        }

        // Initial Layout Placement (simple append)
        let startY = 100;
        if (hasExistingNodes) {
            const maxY = Math.max(...currentNodes.map(n => n.position.y));
            startY = maxY + 400; // Place well below
        }

        newNodes = newNodes.map((node, i) => ({
            ...node,
            position: { x: 200, y: startY + i * 200 }
        }));

        // Add nodes and edges
        setNodes(prev => [...prev, ...newNodes]);
        if (setEdges) {
            setEdges(prev => [...prev, ...newEdges]);
        }

        // Fit view
        if (reactFlowInstance) {
            setTimeout(() => {
                reactFlowInstance.fitView({ padding: 0.2, duration: 1000 });
            }, 100);
        }

        return { nodesCount: newNodes.length, edgesCount: newEdges.length };
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);

        const newHistory = [...chatHistory, userMessage];
        setChatHistory(newHistory);

        setInput('');
        setIsTyping(true);

        try {
            // Call xAI API via Electron IPC
            let response;

            if (window.electronAPI && window.electronAPI.callXaiApi) {
                // Running in Electron
                const result = await window.electronAPI.callXaiApi(newHistory, SYSTEM_PROMPT);
                if (result.success) {
                    response = result.content;
                } else {
                    throw new Error(result.error);
                }
            } else {
                // Fallback for web development
                throw new Error('Vui lòng chạy trong Electron app để sử dụng AI.');
            }

            const parsed = parseAIResponse(response);

            const assistantMessage = {
                role: 'assistant',
                content: parsed.type === 'workflow'
                    ? `${parsed.message}\n\n${parsed.explanation}`
                    : parsed.message,
                nodes: parsed.nodes,
            };

            setMessages(prev => [...prev, assistantMessage]);
            setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Lỗi: ${error.message}`,
            }]);
        }

        setIsTyping(false);
    };

    const handleQuickAction = (action) => {
        setInput(action);
    };

    const handleInsertAllNodes = (nodes) => {
        const result = handleInsertNodes(nodes);
        setMessages(prev => [...prev, {
            role: 'system',
            content: `✅ Đã thêm ${nodes.length} nodes nối tiếp vào workflow!`,
        }]);
    };

    return (
        <div className="ai-assistant">
            <div className="ai-header">
                <h3>🤖 Grok AI Assistant</h3>
                <span className="ai-status">Powered by xAI</span>
            </div>

            <div className="ai-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`ai-message ${msg.role}`}>
                        {msg.role !== 'system' ? (
                            <>
                                <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>
                                    {msg.content}
                                </div>
                                {msg.nodes && msg.nodes.length > 0 && (
                                    <div className="suggested-nodes">
                                        <div className="suggested-label">📦 Nodes sẽ được tạo ({msg.nodes.length}):</div>
                                        <div className="node-preview">
                                            {msg.nodes.map((n, i) => (
                                                <span key={i} className="node-tag">
                                                    {getNodeTooltip(n.type)?.title || n.type}
                                                </span>
                                            ))}
                                        </div>
                                        <button
                                            className="insert-all-btn"
                                            onClick={() => handleInsertAllNodes(msg.nodes)}
                                        >
                                            ➕ Thêm nối tiếp vào Canvas
                                        </button>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="system-message">{msg.content}</div>
                        )}
                    </div>
                ))}
                {isTyping && (
                    <div className="ai-message assistant">
                        <div className="typing-indicator">
                            <span></span><span></span><span></span>
                            <span className="typing-text">Grok đang suy nghĩ...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="ai-quick-actions">
                <button onClick={() => handleQuickAction('Mở url google.com rồi cuộn 3 vòng')}>🌐 Mở URL</button>
                <button onClick={() => handleQuickAction('Lặp 5 lần: click vào 500,800 chờ 1 giây')}>🔁 Lặp Click</button>
                <button onClick={() => handleQuickAction('Tìm hình btn.png rồi click')}>🖼️ Tìm & Click</button>
                <button onClick={() => handleQuickAction('Mở Safari chờ 3 giây rồi vuốt lên')}>📱 Mở App</button>
            </div>

            <div className="ai-input-area">
                <input
                    type="text"
                    className="ai-input"
                    placeholder="Mô tả workflow bạn muốn tạo..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button className="ai-send-btn" onClick={handleSend} disabled={isTyping}>
                    {isTyping ? '...' : 'Gửi'}
                </button>
            </div>
        </div>
    );
}

export default AIAssistant;
