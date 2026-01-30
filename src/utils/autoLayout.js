import dagre from 'dagre';

export const getLayoutedElements = (nodes, edges, direction = 'TB') => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const isHorizontal = direction === 'LR';

    // Set graph configuration
    dagreGraph.setGraph({
        rankdir: direction,
        ranksep: isHorizontal ? 150 : 80,  // Spacing between ranks
        nodesep: isHorizontal ? 80 : 150,  // Spacing between nodes in same rank
        align: 'DL', // Align Direction Left (helps with tree structure)
        marginx: 50,
        marginy: 50
    });

    // Add nodes to dagre
    nodes.forEach((node) => {
        // Approximate node dimensions
        dagreGraph.setNode(node.id, { width: 220, height: 100 });
    });

    // Add edges to dagre
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Layout
    if (direction === 'GRID') {
        const COLUMNS = 5;
        const X_SPACING = 350;
        const Y_SPACING = 400; // Tăng mạnh height (an toàn cho node cao nhất)

        const layoutedNodes = nodes.map((node, index) => {
            const col = index % COLUMNS;
            const row = Math.floor(index / COLUMNS);

            // Snake Logic (Zigzag): 
            // Hàng chẵn (0,2,4): Trái -> Phải
            // Hàng lẻ (1,3,5): Phải -> Trái
            const isEvenRow = row % 2 === 0;
            const actualCol = isEvenRow ? col : (COLUMNS - 1 - col);

            return {
                ...node,
                targetPosition: 'top',
                sourcePosition: 'bottom',
                position: {
                    x: actualCol * X_SPACING, // Dùng actualCol để xếp zigzag
                    y: row * Y_SPACING,
                },
            };
        });
        return { nodes: layoutedNodes, edges };
    }

    dagre.layout(dagreGraph);

    // Get positions
    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        // Dagre returns center point, we need top-left
        return {
            ...node,
            targetPosition: isHorizontal ? 'left' : 'top',
            sourcePosition: isHorizontal ? 'right' : 'bottom',
            position: {
                x: nodeWithPosition.x - 220 / 2,
                y: nodeWithPosition.y - 100 / 2,
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};
