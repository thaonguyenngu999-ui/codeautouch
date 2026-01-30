import { useState } from 'react';
import { nodeCategories } from './nodes/nodeDefinitions';
import { getNodeTooltip } from './nodes/tooltips';

function NodePalette() {
    // Mặc định mở tất cả categories
    const [expandedCategories, setExpandedCategories] = useState(
        new Set(nodeCategories.map(c => c.name))
    );
    const [searchTerm, setSearchTerm] = useState('');
    const [hoveredNode, setHoveredNode] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const toggleCategory = (categoryName) => {
        setExpandedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryName)) {
                newSet.delete(categoryName);
            } else {
                newSet.add(categoryName);
            }
            return newSet;
        });
    };

    const expandAll = () => {
        setExpandedCategories(new Set(nodeCategories.map(c => c.name)));
    };

    const collapseAll = () => {
        setExpandedCategories(new Set());
    };

    const handleMouseEnter = (event, nodeType) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltipPos({
            x: rect.right + 10,
            y: rect.top
        });
        setHoveredNode(nodeType);
    };

    const handleMouseLeave = () => {
        setHoveredNode(null);
    };

    // Filter nodes based on search
    const filteredCategories = nodeCategories.map(cat => ({
        ...cat,
        nodes: cat.nodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.desc.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(cat => cat.nodes.length > 0);

    const tooltip = hoveredNode ? getNodeTooltip(hoveredNode) : null;

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3 className="sidebar-title">🧩 Bảng Node</h3>

                {/* Search */}
                <div className="input-group" style={{ marginBottom: 12 }}>
                    <input
                        type="text"
                        className="input"
                        placeholder="🔍 Tìm kiếm node..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Expand/Collapse Buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11 }} onClick={expandAll}>
                        📂 Mở tất cả
                    </button>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: 11 }} onClick={collapseAll}>
                        📁 Thu gọn
                    </button>
                </div>
            </div>

            <div className="sidebar-content">
                {filteredCategories.map((category) => (
                    <div key={category.name} className="node-category">
                        {/* Category Header */}
                        <div
                            className={`category-header ${expandedCategories.has(category.name) ? 'expanded' : ''}`}
                            onClick={() => toggleCategory(category.name)}
                        >
                            <span className="category-icon">{category.icon}</span>
                            <span className="category-name">{category.name}</span>
                            <span className="category-count">{category.nodes.length}</span>
                            <span className="category-arrow">{expandedCategories.has(category.name) ? '▼' : '▶'}</span>
                        </div>

                        {/* Category Nodes */}
                        {expandedCategories.has(category.name) && (
                            <div className="category-nodes">
                                {category.nodes.map((node) => (
                                    <div
                                        key={node.type}
                                        className="palette-node"
                                        draggable
                                        onDragStart={(e) => onDragStart(e, node.type)}
                                        onMouseEnter={(e) => handleMouseEnter(e, node.type)}
                                        onMouseLeave={handleMouseLeave}
                                    >
                                        <div className="palette-node-icon">{node.icon}</div>
                                        <div className="palette-node-info">
                                            <div className="palette-node-name">{node.name}</div>
                                            <div className="palette-node-desc">{node.desc}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Tooltip popup */}
            {tooltip && (
                <div
                    className="node-tooltip"
                    style={{
                        position: 'fixed',
                        left: tooltipPos.x,
                        top: tooltipPos.y,
                        zIndex: 9999,
                    }}
                >
                    <div className="tooltip-header">{tooltip.title}</div>
                    <div className="tooltip-section">
                        <div className="tooltip-label">📝 Mô tả:</div>
                        <div className="tooltip-text">{tooltip.description}</div>
                    </div>
                    <div className="tooltip-section">
                        <div className="tooltip-label">🛠️ Cách dùng:</div>
                        <div className="tooltip-text" style={{ whiteSpace: 'pre-wrap' }}>{tooltip.howToUse}</div>
                    </div>
                    {tooltip.example && (
                        <div className="tooltip-section">
                            <div className="tooltip-label">💡 Ví dụ:</div>
                            <div className="tooltip-example" style={{ whiteSpace: 'pre-wrap' }}>{tooltip.example}</div>
                        </div>
                    )}
                    {tooltip.tips && (
                        <div className="tooltip-tips">
                            💡 <strong>Mẹo:</strong> {tooltip.tips}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default NodePalette;
