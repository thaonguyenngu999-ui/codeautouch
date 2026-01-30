import { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import ScriptManager from './ScriptManager';
import NodePalette from './NodePalette';
import CodePreview from './CodePreview';
import WorkLogModal from './WorkLogModal';
import AIAssistant from './AIAssistant';
import InteractivePhone from './InteractivePhone';
import { nodeTypes, initialNodes, initialEdges } from './nodes';
import { generateLuaFromNodes, getDefaultNodeData } from '../../utils/luaGenerator';
import { scriptDB, workLogDB } from '../../utils/scriptDB';
import { getLayoutedElements } from '../../utils/autoLayout';

// Toolbar Component - Việt hóa
function EditorToolbar({ scriptName, isRunning, onBack, onRun, onSave, onExport, onWorkLog, onLayout, layoutLabel }) {
    return (
        <div className="editor-toolbar">
            <div className="toolbar-left">
                <button className="btn-back" onClick={onBack}>
                    ← Quay lại
                </button>
                <span className="script-title">📜 {scriptName}</span>
            </div>
            <div className="toolbar-right">
                <button className="btn-toolbar" onClick={onLayout} title="Đổi chế độ sắp xếp (Dọc/Ngang/Lưới)">
                    ✨ {layoutLabel || 'Layout'}
                </button>
                <button className="btn-toolbar" onClick={onWorkLog}>
                    📋 Nhật ký
                </button>
                <button className="btn-toolbar" onClick={onExport}>
                    💾 Xuất Lua
                </button>
                <button className="btn-toolbar primary" onClick={onSave}>
                    ✓ Lưu
                </button>
                <button
                    className={`btn-toolbar run ${isRunning ? 'running' : ''}`}
                    onClick={onRun}
                    disabled={isRunning}
                >
                    {isRunning ? '⏳ Đang chạy...' : '▶️ Chạy'}
                </button>
            </div>
        </div>
    );
}

function ScriptEditorTab() {
    // View mode: 'manager' = danh sách kịch bản, 'editor' = chỉnh sửa
    const [viewMode, setViewMode] = useState('manager');
    const [currentScript, setCurrentScript] = useState(null);

    const reactFlowWrapper = useRef(null);
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [luaCode, setLuaCode] = useState('');
    const [showWorkLog, setShowWorkLog] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [showAI, setShowAI] = useState(true);
    const [showPhone, setShowPhone] = useState(true);
    const [selectedDevice, setSelectedDevice] = useState(null);

    // Clipboard for copy/paste
    const clipboardRef = useRef([]);

    // Generate Lua code whenever nodes/edges change
    useEffect(() => {
        const code = generateLuaFromNodes(nodes, edges);
        setLuaCode(code);
    }, [nodes, edges]);

    // Keyboard shortcuts for copy/paste/duplicate
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Only handle if not typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const selectedNodes = nodes.filter(n => n.selected);

            // Ctrl+C - Copy
            if ((event.ctrlKey || event.metaKey) && event.key === 'c' && selectedNodes.length > 0) {
                clipboardRef.current = selectedNodes.map(n => ({
                    ...n,
                    data: { ...n.data },
                }));
                console.log('Copied', selectedNodes.length, 'nodes');
            }

            // Ctrl+V - Paste
            if ((event.ctrlKey || event.metaKey) && event.key === 'v' && clipboardRef.current.length > 0) {
                event.preventDefault();
                const pastedNodes = clipboardRef.current.map(n => ({
                    ...n,
                    id: `${n.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    position: {
                        x: n.position.x + 50,
                        y: n.position.y + 50,
                    },
                    selected: true,
                    data: { ...n.data },
                }));

                // Deselect current nodes and add pasted
                setNodes(nds => [
                    ...nds.map(n => ({ ...n, selected: false })),
                    ...pastedNodes,
                ]);

                // Update clipboard position for next paste
                clipboardRef.current = pastedNodes.map(n => ({
                    ...n,
                    selected: false,
                }));
                console.log('Pasted', pastedNodes.length, 'nodes');
            }

            // Ctrl+D - Duplicate (in place)
            if ((event.ctrlKey || event.metaKey) && event.key === 'd' && selectedNodes.length > 0) {
                event.preventDefault();
                const duplicatedNodes = selectedNodes.map(n => ({
                    ...n,
                    id: `${n.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    position: {
                        x: n.position.x + 30,
                        y: n.position.y + 30,
                    },
                    selected: true,
                    data: { ...n.data },
                }));

                setNodes(nds => [
                    ...nds.map(n => ({ ...n, selected: false })),
                    ...duplicatedNodes,
                ]);
                console.log('Duplicated', duplicatedNodes.length, 'nodes');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [nodes]);

    // Handle edit script from manager
    const handleEditScript = (script) => {
        setCurrentScript(script);
        setNodes(script.nodes || initialNodes);
        setEdges(script.edges || initialEdges);
        setViewMode('editor');
    };

    // Back to manager
    const handleBackToManager = () => {
        setViewMode('manager');
    };

    const onNodesChange = useCallback(
        (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
        []
    );

    const onEdgesChange = useCallback(
        (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        []
    );

    const [layoutDirection, setLayoutDirection] = useState('TB');

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge({
            ...params,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        }, eds)),
        []
    );

    const onLayout = useCallback(() => {
        // Cycle: TB (Dọc) -> LR (Ngang) -> GRID (Lưới 5 cột) -> TB
        let newDirection = 'TB';
        if (layoutDirection === 'TB') newDirection = 'LR';
        else if (layoutDirection === 'LR') newDirection = 'GRID';

        setLayoutDirection(newDirection);

        const layouted = getLayoutedElements(nodes, edges, newDirection);
        setNodes([...layouted.nodes]);
        setEdges([...layouted.edges]);

        if (reactFlowInstance) {
            setTimeout(() => reactFlowInstance.fitView({ padding: 0.2, duration: 800 }), 50);
        }
    }, [nodes, edges, layoutDirection, reactFlowInstance]);

    const getLayoutLabel = () => {
        if (layoutDirection === 'TB') return '⬇️ Dọc';
        if (layoutDirection === 'LR') return '➡️ Ngang';
        return '▦ Lưới';
    };

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');
            if (!type || !reactFlowInstance) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const newNode = {
                id: `${type}-${Date.now()}`,
                type,
                position,
                data: getDefaultNodeData(type),
            };

            setNodes((nds) => [...nds, newNode]);
        },
        [reactFlowInstance]
    );

    // ===== Toolbar Actions =====

    const handleRun = async () => {
        setIsRunning(true);

        const targetDeviceIp = selectedDevice?.ip || '192.168.1.176';
        const scriptName = currentScript?.name || '_autotouch_builder_temp';
        const remotePath = '/Vcuto'; // /var/mobile/Library/AutoTouch/Vcuto/

        workLogDB.add({
            scriptId: currentScript?.id,
            scriptName: scriptName,
            action: 'run',
            status: 'pending',
            message: `Đang gửi script đến ${targetDeviceIp}...`,
        });

        try {
            if (window.electronAPI?.saveScriptFile) {
                await window.electronAPI.saveScriptFile({
                    scriptName,
                    luaCode,
                });
            }

            // Step 2: Upload to iPhone
            if (window.electronAPI?.uploadScriptToDevice) {
                const uploadResult = await window.electronAPI.uploadScriptToDevice({
                    deviceIp: targetDeviceIp,
                    scriptName,
                    luaCode,
                    remotePath,
                });

                if (!uploadResult.success) {
                    throw new Error(`Upload failed: ${uploadResult.error}`);
                }

                // Delay 3 seconds as requested to ensure file is ready
                const delayMs = 3000;
                workLogDB.add({
                    scriptId: currentScript?.id,
                    scriptName,
                    action: 'run',
                    status: 'pending',
                    message: `Đã upload xong. Đợi ${delayMs / 1000}s trước khi chạy...`,
                });
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Step 3: Run on iPhone
                const fileName = scriptName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lua';
                const remoteFilePath = `${remotePath}/${fileName}`;

                const runResult = await window.electronAPI.runScriptOnDevice({
                    deviceIp: targetDeviceIp,
                    scriptPath: remoteFilePath,
                });

                if (runResult.success) {
                    workLogDB.add({
                        scriptId: currentScript?.id,
                        scriptName,
                        action: 'run',
                        status: 'success',
                    });
                    // alert(`✅ Script đã được chạy trên ${targetDeviceIp}!`);
                } else {
                    throw new Error(runResult.error || 'Failed to run script');
                }
            } else {
                // Fallback: Direct fetch (browser context)
                const apiPort = 8080;
                const fileName = scriptName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lua';
                const scriptPath = `${remotePath}/${fileName}`;

                // Create file
                await fetch(`http://${demoDeviceIp}:${apiPort}/file/new?path=${encodeURIComponent(scriptPath)}`);

                // Run script
                const playResponse = await fetch(`http://${demoDeviceIp}:${apiPort}/control/start_playing?path=${encodeURIComponent(scriptPath)}`);
                const result = await playResponse.json();

                if (result.status === 'success') {
                    // console.log(`✅ Script đã được chạy trên ${demoDeviceIp}!`);
                } else {
                    throw new Error(result.info || 'Unknown error');
                }
            }
        } catch (err) {
            console.error('Run script error:', err);
            workLogDB.add({
                scriptId: currentScript?.id,
                scriptName,
                action: 'run',
                status: 'error',
                message: `Lỗi: ${err.message}`,
            });
            alert(`⚠️ Không thể chạy script!\n\nLỗi: ${err.message}\n\nĐảm bảo:\n1. AutoTouch Web Server đang chạy (port 8080)\n2. Máy tính và iPhone cùng mạng`);
        } finally {
            setIsRunning(false);
        }
    };

    const handleSave = () => {
        const script = scriptDB.save({
            id: currentScript?.id,
            name: currentScript?.name || 'Kịch bản mới',
            folder: currentScript?.folder || 'Mặc định',
            nodes,
            edges,
            luaCode,
        });

        setCurrentScript(script);

        workLogDB.add({
            scriptId: script.id,
            scriptName: script.name,
            action: 'save',
            status: 'success',
        });

        // alert('Đã lưu kịch bản!');
    };

    const handleExport = () => {
        scriptDB.exportToFile({
            name: currentScript?.name || 'kichban',
            luaCode,
        });

        workLogDB.add({
            scriptId: currentScript?.id,
            scriptName: currentScript?.name || 'Chưa đặt tên',
            action: 'export',
            status: 'success',
        });
    };

    // ===== Capture Handlers (from InteractivePhone) =====
    const handleCaptureTap = useCallback(({ x, y, deviceIp }) => {
        // Find the last node to connect to
        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
        const lastNodeId = lastNode?.id;

        // Calculate position for new node
        const newX = lastNode ? lastNode.position.x : 400;
        const newY = lastNode ? lastNode.position.y + 150 : 200;

        const newNode = {
            id: `tapNode-${Date.now()}`,
            type: 'tapNode',
            position: { x: newX, y: newY },
            data: { x, y, times: 1 },
        };

        setNodes((nds) => [...nds, newNode]);

        // Create edge from last node to new node
        if (lastNodeId) {
            const newEdge = {
                id: `edge-${lastNodeId}-${newNode.id}`,
                source: lastNodeId,
                target: newNode.id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'url(#edge-gradient)', strokeWidth: 2 },
            };
            setEdges((eds) => [...eds, newEdge]);
        }

        console.log(`Created tap node at (${x}, ${y})`);
    }, [nodes]);

    const handleCaptureSwipe = useCallback(({ startX, startY, endX, endY, deviceIp }) => {
        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
        const lastNodeId = lastNode?.id;

        const newX = lastNode ? lastNode.position.x : 400;
        const newY = lastNode ? lastNode.position.y + 150 : 200;

        const newNode = {
            id: `swipeNode-${Date.now()}`,
            type: 'swipeNode',
            position: { x: newX, y: newY },
            data: { startX, startY, endX, endY, duration: 300 },
        };

        setNodes((nds) => [...nds, newNode]);

        if (lastNodeId) {
            const newEdge = {
                id: `edge-${lastNodeId}-${newNode.id}`,
                source: lastNodeId,
                target: newNode.id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'url(#edge-gradient)', strokeWidth: 2 },
            };
            setEdges((eds) => [...eds, newEdge]);
        }

        console.log(`Created swipe node from (${startX}, ${startY}) to (${endX}, ${endY})`);
    }, [nodes]);

    const handleCaptureColor = useCallback(({ x, y, color, points, deviceIp }) => {
        // If points exists, it's a multi-color capture
        if (points && points.length > 0) {
            const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
            const lastNodeId = lastNode?.id;
            const newX = lastNode ? lastNode.position.x : 400;
            const newY = lastNode ? lastNode.position.y + 150 : 200;

            // Format as {{color, dx, dy}, ...}
            // Anchor point (pixel 1) is 0,0
            const anchor = points[0];
            const colorsStr = "{" + points.map(p => {
                const dec = parseInt(p.color.replace('0x', ''), 16);
                const dx = Math.round(p.x - anchor.x);
                const dy = Math.round(p.y - anchor.y);
                return `{${dec}, ${dx}, ${dy}}`;
            }).join(', ') + "}";

            const newNode = {
                id: `findColorsNode-${Date.now()}`,
                type: 'findColorsNode',
                position: { x: newX, y: newY },
                selected: true,
                data: { colors: colorsStr, region: 'nil', count: 0, variable: 'colorResult', tolerance: 90 },
            };

            // Logic nodes - use unique suffixes to prevent ID collision
            const foundNode = {
                id: `found-alert-${Date.now()}-1`,
                type: 'alertNode',
                position: { x: newX - 150, y: newY + 200 },
                data: { message: 'Tìm thấy màu!' }
            };

            const notFoundNode = {
                id: `notfound-alert-${Date.now()}-2`,
                type: 'alertNode',
                position: { x: newX + 150, y: newY + 200 },
                data: { message: 'Không thấy màu!' }
            };

            setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode, foundNode, notFoundNode]);

            const newEdges = [];
            if (lastNodeId) {
                newEdges.push({ id: `e-${lastNodeId}-${newNode.id}`, source: lastNodeId, target: newNode.id, type: 'smoothstep', animated: true });
            }
            newEdges.push({ id: `ef-${newNode.id}-${foundNode.id}`, source: newNode.id, target: foundNode.id, sourceHandle: 'found', type: 'smoothstep', animated: true });
            newEdges.push({ id: `enf-${newNode.id}-${notFoundNode.id}`, source: newNode.id, target: notFoundNode.id, sourceHandle: 'not_found', type: 'smoothstep', animated: true });

            setEdges(eds => [...eds, ...newEdges]);
            return;
        }

        // --- Single Color Mode ---
        // Find if a color-related node is selected
        const selectedNode = nodes.find(n => n.selected && (n.type === 'findColorNode' || n.type === 'getColorNode'));

        if (selectedNode) {
            // Update selected node
            if (selectedNode.type === 'findColorNode') {
                const decColor = parseInt(color.replace('0x', ''), 16);
                const rx = Math.round(x) - 2;
                const ry = Math.round(y) - 2;
                setNodes(nds => nds.map(n => n.id === selectedNode.id ? {
                    ...n,
                    data: { ...n.data, color: color.toLowerCase(), colorDec: decColor, region: `{${rx}, ${ry}, 4, 4}` }
                } : n));
            } else {
                // getColorNode
                setNodes(nds => nds.map(n => n.id === selectedNode.id ? {
                    ...n,
                    data: { ...n.data, x: Math.round(x), y: Math.round(y) }
                } : n));
            }
            console.log(`Updated ${selectedNode.type} with color ${color} at ${x},${y}`);
        } else {
            // Create new node at the end (default to findColorNode)
            const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
            const lastNodeId = lastNode?.id;
            const newX = lastNode ? lastNode.position.x : 400;
            const newY = lastNode ? lastNode.position.y + 150 : 200;

            const decColor = parseInt(color.replace('0x', ''), 16);
            const rx = Math.round(x) - 2;
            const ry = Math.round(y) - 2;
            const newNode = {
                id: `findColorNode-${Date.now()}`,
                type: 'findColorNode',
                position: { x: newX, y: newY },
                selected: true,
                data: { color: color.toLowerCase(), colorDec: decColor, region: `{${rx}, ${ry}, 4, 4}`, count: 1, variable: 'colorResult' },
            };

            const foundNode = {
                id: `found-alert-${Date.now()}-1`,
                type: 'alertNode',
                position: { x: newX - 150, y: newY + 200 },
                data: { message: 'co' }
            };

            const notFoundNode = {
                id: `notfound-alert-${Date.now()}-2`,
                type: 'alertNode',
                position: { x: newX + 150, y: newY + 200 },
                data: { message: 'k' }
            };

            setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode, foundNode, notFoundNode]);

            const newEdges = [];
            if (lastNodeId) {
                newEdges.push({ id: `e-${lastNodeId}-${newNode.id}`, source: lastNodeId, target: newNode.id, type: 'smoothstep', animated: true });
            }
            newEdges.push({ id: `ef-${newNode.id}-${foundNode.id}`, source: newNode.id, target: foundNode.id, sourceHandle: 'found', type: 'smoothstep', animated: true });
            newEdges.push({ id: `enf-${newNode.id}-${notFoundNode.id}`, source: newNode.id, target: notFoundNode.id, sourceHandle: 'not_found', type: 'smoothstep', animated: true });

            setEdges(eds => [...eds, ...newEdges]);
            console.log(`Created new findColor node with color ${color} at ${x},${y}`);
        }
    }, [nodes]);

    const handleCaptureCoord = useCallback(({ x, y, deviceIp }) => {
        const lastNode = nodes.length > 0 ? nodes[nodes.length - 1] : null;
        const lastNodeId = lastNode?.id;
        const newX = lastNode ? lastNode.position.x : 400;
        const newY = lastNode ? lastNode.position.y + 150 : 200;

        const newNode = {
            id: `coordinateNode-${Date.now()}`,
            type: 'coordinateNode',
            position: { x: newX, y: newY },
            selected: true,
            data: { x: Math.round(x), y: Math.round(y), variable: 'tap' },
        };

        setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), newNode]);

        if (lastNodeId) {
            const newEdge = {
                id: `edge-${lastNodeId}-${newNode.id}`,
                source: lastNodeId,
                target: newNode.id,
                type: 'smoothstep',
                animated: true,
                style: { stroke: 'url(#edge-gradient)', strokeWidth: 2 },
            };
            setEdges(eds => [...eds, newEdge]);
        }
        console.log(`Created coordinate alert node at (${x}, ${y})`);
    }, [nodes]);

    // Render Manager view
    if (viewMode === 'manager') {
        return <ScriptManager onEditScript={handleEditScript} />;
    }

    // Render Editor view
    return (
        <div className="script-editor">
            {/* Toolbar */}
            <EditorToolbar
                scriptName={currentScript?.name || 'Kịch bản mới'}
                isRunning={isRunning}
                onBack={handleBackToManager}
                onRun={handleRun}
                onSave={handleSave}
                onExport={handleExport}
                onWorkLog={() => setShowWorkLog(true)}
                onLayout={onLayout}
                layoutLabel={getLayoutLabel()}
            />

            <div className="script-editor-content">
                {/* Node Palette Sidebar */}
                <NodePalette />

                {/* React Flow Canvas */}
                <div className="flow-canvas" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        fitView
                        snapToGrid
                        snapGrid={[15, 15]}
                        deleteKeyCode={['Backspace', 'Delete']}
                        defaultEdgeOptions={{
                            animated: true,
                            style: { stroke: 'url(#edge-gradient)', strokeWidth: 2 },
                        }}
                    >
                        {/* SVG Gradient Definition for Edges */}
                        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                            <defs>
                                <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#e92a67" />
                                    <stop offset="50%" stopColor="#a853ba" />
                                    <stop offset="100%" stopColor="#2a8af6" />
                                </linearGradient>
                            </defs>
                        </svg>
                        <Background color="#2a2a3a" gap={20} size={1} />
                        <Controls />
                        <MiniMap
                            style={{ background: '#1a1a25' }}
                            nodeColor={(node) => {
                                switch (node.type) {
                                    case 'tapNode': return '#ef4444';
                                    case 'swipeNode': return '#3b82f6';
                                    case 'waitNode': return '#f59e0b';
                                    case 'forNode':
                                    case 'whileNode':
                                    case 'forEachNode': return '#8b5cf6';
                                    case 'ifNode':
                                    case 'ifElseNode': return '#10b981';
                                    case 'startNode': return '#22c55e';
                                    default: return '#6366f1';
                                }
                            }}
                            maskColor="rgba(0, 0, 0, 0.5)"
                        />
                    </ReactFlow>
                </div>

                {/* Code Preview Panel */}
                <CodePreview code={luaCode} />

                {/* Interactive Phone Panel */}
                {showPhone && (
                    <InteractivePhone
                        onTap={handleCaptureTap}
                        onSwipe={handleCaptureSwipe}
                        onColorCapture={handleCaptureColor}
                        onCoordCapture={handleCaptureCoord}
                        onDeviceChange={setSelectedDevice}
                    />
                )}

                {/* AI Assistant Panel */}
                {showAI && (
                    <div className="ai-panel">
                        <AIAssistant
                            nodes={nodes}
                            setNodes={setNodes}
                            setEdges={setEdges}
                            reactFlowInstance={reactFlowInstance}
                        />
                    </div>
                )}
            </div>

            {/* AI Toggle Button */}
            <button
                className="ai-toggle-btn"
                onClick={() => setShowAI(!showAI)}
                style={{ right: showAI ? '330px' : '20px' }}
                title={showAI ? 'Ẩn AI Assistant' : 'Mở AI Assistant'}
            >
                {showAI ? '🤖' : '🤖'}
            </button>

            {/* Work Log Modal */}
            {showWorkLog && (
                <WorkLogModal onClose={() => setShowWorkLog(false)} />
            )}
        </div>
    );
}

export default ScriptEditorTab;
