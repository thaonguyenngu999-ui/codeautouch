import { Handle, Position, useReactFlow } from '@xyflow/react';
import { useCallback } from 'react';

// ===== Custom hook to update node data =====
function useNodeData(id) {
    const { setNodes } = useReactFlow();

    const updateData = useCallback((key, value) => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            [key]: value,
                        },
                    };
                }
                return node;
            })
        );
    }, [id, setNodes]);

    return updateData;
}

// ===== Base Node Component (Turbo Flow Style) =====
function BaseNode({ data, selected, nodeType, icon, title, children, handles = { top: true, bottom: true } }) {
    return (
        <div className={`custom-node node-${nodeType} ${selected ? 'selected' : ''}`}>
            {handles.top && <Handle type="target" position={Position.Top} />}
            <div className="wrapper">
                <div className="inner">
                    <div className="node-header">
                        <div className="node-icon">{icon}</div>
                        <div className="node-title">{title}</div>
                    </div>
                    <div className="node-body">
                        {children}
                    </div>
                    {handles.labels && (
                        <div className="loop-handles-label">
                            {handles.labels.map((label, idx) => (
                                <span key={idx}>{label}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {/* Status indicator badge - VIP style */}
            <div className="cloud-badge">
                <div className="cloud-badge-inner">
                    <span className="status-icon">⚡</span>
                </div>
            </div>
            {handles.bottom && !handles.sources && <Handle type="source" position={Position.Bottom} />}
            {handles.sources && handles.sources.map((source, idx) => (
                <Handle
                    key={idx}
                    type="source"
                    position={Position.Bottom}
                    id={source.id}
                    style={{ left: source.left }}
                />
            ))}
        </div>
    );
}

// ===== Field Components =====
function TextField({ label, value, onChange, placeholder }) {
    return (
        <div className="node-field">
            <div className="node-label">{label}</div>
            <input
                className="node-input"
                type="text"
                value={value || ''}
                placeholder={placeholder}
                onChange={e => onChange?.(e.target.value)}
            />
        </div>
    );
}

function NumberField({ label, value, onChange, min, max, step }) {
    return (
        <div className="node-field">
            <div className="node-label">{label}</div>
            <input
                className="node-input"
                type="number"
                value={value ?? 0}
                min={min}
                max={max}
                step={step}
                onChange={e => onChange?.(Number(e.target.value))}
            />
        </div>
    );
}

function SelectField({ label, value, options, onChange }) {
    return (
        <div className="node-field">
            <div className="node-label">{label}</div>
            <select
                className="node-input"
                value={value || options[0]?.value}
                onChange={e => onChange?.(e.target.value)}
            >
                {options.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
            </select>
        </div>
    );
}

function TextAreaField({ label, value, onChange, placeholder, rows = 3 }) {
    return (
        <div className="node-field">
            <div className="node-label">{label}</div>
            <textarea
                className="node-input node-textarea"
                value={value || ''}
                placeholder={placeholder}
                rows={rows}
                onChange={e => onChange?.(e.target.value)}
            />
        </div>
    );
}

function CheckboxField({ label, checked, onChange }) {
    return (
        <label style={{ fontSize: 10, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
                type="checkbox"
                checked={checked || false}
                onChange={e => onChange?.(e.target.checked)}
            />
            {label}
        </label>
    );
}

// ========================================
// CONTROL FLOW NODES
// ========================================

export function StartNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="control" icon="▶️" title="Start" handles={{ top: false, bottom: true }}>
            <div className="node-hint">Script entry point</div>
        </BaseNode>
    );
}

export function IfNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="control" icon="❓" title="If">
            <TextField label="Condition" value={data.condition} placeholder="color == 0xFF0000" onChange={v => updateData('condition', v)} />
        </BaseNode>
    );
}

// ===== Loop Node Component (2 output handles) =====
function LoopNode({ data, selected, nodeType, icon, title, children }) {
    return (
        <div className={`custom-node node-${nodeType} ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} />
            <div className="wrapper">
                <div className="inner">
                    <div className="node-header">
                        <div className="node-icon">{icon}</div>
                        <div className="node-title">{title}</div>
                    </div>
                    <div className="node-body">
                        {children}
                    </div>
                    <div className="loop-handles-label">
                        <span>🔄 Thân vòng lặp</span>
                        <span>➡️ Tiếp theo</span>
                    </div>
                </div>
            </div>
            {/* Status indicator badge */}
            <div className="cloud-badge">
                <div className="cloud-badge-inner">
                    <span className="status-icon">⚡</span>
                </div>
            </div>
            {/* 2 output handles: body (left) and next (right) */}
            <Handle type="source" position={Position.Bottom} id="body" style={{ left: '30%' }} />
            <Handle type="source" position={Position.Bottom} id="next" style={{ left: '70%' }} />
        </div>
    );
}

export function IfElseNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <div className={`custom-node node-control ${selected ? 'selected' : ''}`}>
            <Handle type="target" position={Position.Top} />
            <div className="wrapper">
                <div className="inner">
                    <div className="node-header">
                        <div className="node-icon">🔀</div>
                        <div className="node-title">Nếu/Không thì</div>
                    </div>
                    <div className="node-body">
                        <TextField label="Điều kiện" value={data.condition} placeholder="color == 0xFF0000" onChange={v => updateData('condition', v)} />
                    </div>
                    <div className="loop-handles-label">
                        <span>✅ Đúng</span>
                        <span>❌ Sai</span>
                    </div>
                </div>
            </div>
            <div className="cloud-badge">
                <div className="cloud-badge-inner">
                    <span className="status-icon">⚡</span>
                </div>
            </div>
            {/* 2 outputs: true (left) and false (right) */}
            <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
            <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
        </div>
    );
}

export function WhileNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <LoopNode data={data} selected={selected} nodeType="control" icon="🔁" title="Vòng lặp While">
            <TextField label="Điều kiện" value={data.condition} placeholder="color ~= target" onChange={v => updateData('condition', v)} />
            <NumberField label="Lặp tối đa" value={data.maxIterations || 100} min={1} onChange={v => updateData('maxIterations', v)} />
        </LoopNode>
    );
}

export function ForNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <LoopNode data={data} selected={selected} nodeType="control" icon="🔢" title="Vòng lặp For">
            <TextField label="Biến" value={data.variable || 'i'} onChange={v => updateData('variable', v)} />
            <NumberField label="Bắt đầu" value={data.start || 1} onChange={v => updateData('start', v)} />
            <NumberField label="Kết thúc" value={data.end || 10} onChange={v => updateData('end', v)} />
            <NumberField label="Bước" value={data.step || 1} onChange={v => updateData('step', v)} />
        </LoopNode>
    );
}

export function ForEachNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <LoopNode data={data} selected={selected} nodeType="control" icon="📃" title="Duyệt mảng">
            <TextField label="Biến khóa" value={data.keyVar || 'k'} onChange={v => updateData('keyVar', v)} />
            <TextField label="Biến giá trị" value={data.valueVar || 'v'} onChange={v => updateData('valueVar', v)} />
            <TextField label="Mảng/Table" value={data.table} placeholder="results" onChange={v => updateData('table', v)} />
        </LoopNode>
    );
}

export function BreakNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="control" icon="🛑" title="Thoát vòng lặp">
            <div className="node-hint">break - Thoát khỏi loop hiện tại</div>
        </BaseNode>
    );
}

export function StopNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="control" icon="⏹️" title="Dừng Script" handles={{ top: true, bottom: false }}>
            <div className="node-hint">stop() - Kết thúc kịch bản</div>
        </BaseNode>
    );
}

// ========================================
// TOUCH NODES
// ========================================

export function TapNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="👆" title="Tap">
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
            <NumberField label="Count" value={data.count || 1} min={1} onChange={v => updateData('count', v)} />
        </BaseNode>
    );
}

export function TouchDownNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="⬇️" title="Touch Down">
            <NumberField label="Finger ID" value={data.fingerId || 0} min={0} max={9} onChange={v => updateData('fingerId', v)} />
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
        </BaseNode>
    );
}

export function TouchMoveNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="👉" title="Touch Move">
            <NumberField label="Finger ID" value={data.fingerId || 0} min={0} max={9} onChange={v => updateData('fingerId', v)} />
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
        </BaseNode>
    );
}

export function TouchUpNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="⬆️" title="Touch Up">
            <NumberField label="Finger ID" value={data.fingerId || 0} min={0} max={9} onChange={v => updateData('fingerId', v)} />
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
        </BaseNode>
    );
}

export function SwipeNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="↔️" title="Swipe">
            <SelectField
                label="Direction"
                value={data.direction || 'up'}
                options={[
                    { value: 'up', label: 'Up' },
                    { value: 'down', label: 'Down' },
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                    { value: 'custom', label: 'Custom' },
                ]}
                onChange={v => updateData('direction', v)}
            />
            {data.direction === 'custom' && (
                <>
                    <NumberField label="Start X" value={data.startX || 200} onChange={v => updateData('startX', v)} />
                    <NumberField label="Start Y" value={data.startY || 400} onChange={v => updateData('startY', v)} />
                    <NumberField label="End X" value={data.endX || 200} onChange={v => updateData('endX', v)} />
                    <NumberField label="End Y" value={data.endY || 100} onChange={v => updateData('endY', v)} />
                </>
            )}
            <NumberField label="Duration (ms)" value={data.duration || 300} min={50} onChange={v => updateData('duration', v)} />
        </BaseNode>
    );
}

export function LongPressNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="✋" title="Long Press">
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
            <NumberField label="Duration (ms)" value={data.duration || 1000} min={100} onChange={v => updateData('duration', v)} />
        </BaseNode>
    );
}

export function PinchNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="touch" icon="🤏" title="Pinch/Zoom">
            <SelectField
                label="Action"
                value={data.action || 'in'}
                options={[
                    { value: 'in', label: 'Pinch In (Zoom Out)' },
                    { value: 'out', label: 'Pinch Out (Zoom In)' },
                ]}
                onChange={v => updateData('action', v)}
            />
            <NumberField label="Center X" value={data.centerX || 200} onChange={v => updateData('centerX', v)} />
            <NumberField label="Center Y" value={data.centerY || 400} onChange={v => updateData('centerY', v)} />
            <NumberField label="Scale" value={data.scale || 0.5} step={0.1} min={0.1} max={2} onChange={v => updateData('scale', v)} />
        </BaseNode>
    );
}

// ========================================
// PHYSICAL KEY NODES
// ========================================

export function PressHomeNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🏠" title="Press Home">
            <div className="node-hint">KEY_TYPE.HOME_BUTTON</div>
        </BaseNode>
    );
}

export function PressPowerNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🔌" title="Press Power">
            <div className="node-hint">KEY_TYPE.POWER_BUTTON</div>
        </BaseNode>
    );
}

export function PressVolumeUpNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🔊" title="Volume Up">
            <div className="node-hint">KEY_TYPE.VOLUME_UP_BUTTON</div>
        </BaseNode>
    );
}

export function PressVolumeDownNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🔉" title="Volume Down">
            <div className="node-hint">KEY_TYPE.VOLUME_DOWN_BUTTON</div>
        </BaseNode>
    );
}

export function LockScreenNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🔒" title="Lock Screen">
            <div className="node-hint">Press power to lock</div>
        </BaseNode>
    );
}

export function UnlockScreenNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="key" icon="🔓" title="Unlock Screen">
            <div className="node-hint">Press power + swipe</div>
        </BaseNode>
    );
}

// ========================================
// TEXT INPUT NODES
// ========================================

export function InputTextNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="text" icon="📝" title="Input Text">
            <TextAreaField label="Text" value={data.text} placeholder="Text to type..." onChange={v => updateData('text', v)} />
        </BaseNode>
    );
}

export function CopyTextNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="text" icon="📋" title="Copy Text">
            <TextField label="Text" value={data.text} placeholder="Text to copy" onChange={v => updateData('text', v)} />
        </BaseNode>
    );
}

export function ClipTextNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="text" icon="📄" title="Get Clipboard">
            <TextField label="Store in Variable" value={data.variable || 'clipboardText'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

// ========================================
// COLOR & IMAGE NODES
// ========================================

export function CoordinateNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="color" icon="📍" title="Lấy Tọa Độ">
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
            <TextField label="Tên biến" value={data.variable || 'tap'} onChange={v => updateData('variable', v)} />
            <div className="node-hint">Tạo local {data.variable || 'tap'} = {'{x, y}'} & alert</div>
        </BaseNode>
    );
}

export function GetColorNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="color" icon="🎨" title="Get Color">
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
            <TextField label="Store in Variable" value={data.variable || 'color'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function GetColorsNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="color" icon="🌈" title="Get Colors">
            <TextAreaField label="Locations {{x,y}, ...}" value={data.locations} placeholder="{{100,200}, {300,400}}" onChange={v => updateData('locations', v)} />
            <TextField label="Store in Variable" value={data.variable || 'colors'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function FindColorNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode
            data={data}
            selected={selected}
            nodeType="color"
            icon="🔍"
            title="Tìm Màu"
            handles={{
                top: true,
                bottom: false,
                labels: ['✅ Có', '❌ Không'],
                sources: [
                    { id: 'found', left: '30%' },
                    { id: 'not_found', left: '70%' }
                ]
            }}
        >
            <TextField label="Màu (hex)" value={data.color} placeholder="0xFF0000" onChange={v => updateData('color', v)} />
            <NumberField label="Số kết quả (0=tất cả)" value={data.count || 1} min={0} onChange={v => updateData('count', v)} />
            <TextField label="Vùng tìm" value={data.region} placeholder="{x, y, width, height}" onChange={v => updateData('region', v)} />
            <div style={{ fontSize: '10px', color: '#888', marginTop: '-4px', cursor: 'pointer', textAlign: 'right' }} onClick={() => updateData('region', 'nil')}>
                (Click để tìm toàn màn hình)
            </div>
            <div className="node-options">
                <CheckboxField label="Debug" checked={data.debug} onChange={v => updateData('debug', v)} />
                <CheckboxField label="Phải→Trái" checked={data.rightToLeft} onChange={v => updateData('rightToLeft', v)} />
                <CheckboxField label="Dưới→Trên" checked={data.bottomToTop} onChange={v => updateData('bottomToTop', v)} />
            </div>
            <TextField label="Lưu vào biến" value={data.variable || 'result'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function FindColorsNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode
            data={data}
            selected={selected}
            nodeType="color"
            icon="🔎"
            title="Tìm Nhiều Màu"
            handles={{
                top: true,
                bottom: false,
                labels: ['✅ Có', '❌ Không'],
                sources: [
                    { id: 'found', left: '30%' },
                    { id: 'not_found', left: '70%' }
                ]
            }}
        >
            <TextAreaField label="Màu {{color,dx,dy}, ...}" value={data.colors} placeholder="{{0xFF0000,0,0}, {0x00FF00,10,10}}" onChange={v => updateData('colors', v)} />
            <NumberField label="Số kết quả (0=tất cả)" value={data.count || 0} min={0} onChange={v => updateData('count', v)} />
            <NumberField label="Độ chính xác (0-100%)" value={data.tolerance !== undefined ? data.tolerance : 100} min={0} max={100} onChange={v => updateData('tolerance', v)} />
            <TextField label="Vùng tìm" value={data.region} placeholder="{x, y, width, height}" onChange={v => updateData('region', v)} />
            <div className="node-options">
                <CheckboxField label="Debug" checked={data.debug} onChange={v => updateData('debug', v)} />
                <CheckboxField label="Phải→Trái" checked={data.rightToLeft} onChange={v => updateData('rightToLeft', v)} />
                <CheckboxField label="Dưới→Trên" checked={data.bottomToTop} onChange={v => updateData('bottomToTop', v)} />
            </div>
            <TextField label="Lưu vào biến" value={data.variable || 'result'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function FindImageNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode
            data={data}
            selected={selected}
            nodeType="color"
            icon="🖼️"
            title="Tìm Hình"
            handles={{
                top: true,
                bottom: false,
                labels: ['✅ Có', '❌ Không'],
                sources: [
                    { id: 'found', left: '30%' },
                    { id: 'not_found', left: '70%' }
                ]
            }}
        >
            <TextField label="Đường dẫn hình" value={data.imagePath} placeholder="images/button.png" onChange={v => updateData('imagePath', v)} />
            <NumberField label="Số kết quả" value={data.count || 1} min={1} onChange={v => updateData('count', v)} />
            <NumberField label="Ngưỡng (0-1)" value={data.threshold || 0.9} step={0.01} min={0} max={1} onChange={v => updateData('threshold', v)} />
            <TextField label="Vùng tìm" value={data.region} placeholder="{x, y, width, height}" onChange={v => updateData('region', v)} />
            <div className="node-options">
                <CheckboxField label="Debug" checked={data.debug} onChange={v => updateData('debug', v)} />
                <SelectField label="Phương thức" value={data.method || '1'} options={[
                    { value: '1', label: 'Phương thức 1' },
                    { value: '2', label: 'Phương thức 2' }
                ]} onChange={v => updateData('method', v)} />
            </div>
            <TextField label="Lưu vào biến" value={data.variable || 'result'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function ScreenshotNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="color" icon="📸" title="Screenshot">
            <TextField label="File Path (optional)" value={data.filePath} placeholder="images/screenshot.png" onChange={v => updateData('filePath', v)} />
            <TextField label="Region (optional)" value={data.region} placeholder="{x, y, width, height}" onChange={v => updateData('region', v)} />
        </BaseNode>
    );
}

// ========================================
// APP CONTROL NODES
// ========================================

export function AppRunNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="▶️" title="Run App">
            <TextField label="Bundle ID" value={data.bundleId} placeholder="com.apple.mobilesafari" onChange={v => updateData('bundleId', v)} />
        </BaseNode>
    );
}

export function AppKillNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="⏹️" title="Kill App">
            <TextField label="Bundle ID" value={data.bundleId} placeholder="com.apple.mobilesafari" onChange={v => updateData('bundleId', v)} />
        </BaseNode>
    );
}

export function AppStateNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="📊" title="App State">
            <TextField label="Bundle ID" value={data.bundleId} placeholder="com.apple.mobilesafari" onChange={v => updateData('bundleId', v)} />
            <TextField label="Store in Variable" value={data.variable || 'appState'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function AppInfoNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="ℹ️" title="App Info">
            <TextField label="Bundle ID" value={data.bundleId} placeholder="com.apple.mobilesafari" onChange={v => updateData('bundleId', v)} />
            <TextField label="Store in Variable" value={data.variable || 'appInfo'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function FrontMostAppNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="📱" title="Front Most App">
            <TextField label="Store in Variable" value={data.variable || 'frontApp'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function OpenUrlNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="app" icon="🔗" title="Open URL">
            <TextField label="URL" value={data.url} placeholder="https://example.com" onChange={v => updateData('url', v)} />
        </BaseNode>
    );
}

// ========================================
// WAIT & TIMING NODES
// ========================================

export function WaitNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="wait" icon="⏸️" title="Wait/Pause">
            <NumberField label="Duration (ms)" value={data.duration || 1000} min={1} onChange={v => updateData('duration', v)} />
            <div className="node-hint">usleep({(data.duration || 1000) * 1000})</div>
        </BaseNode>
    );
}

export function WaitForColorNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="wait" icon="🎨" title="Wait for Color">
            <NumberField label="X" value={data.x || 0} onChange={v => updateData('x', v)} />
            <NumberField label="Y" value={data.y || 0} onChange={v => updateData('y', v)} />
            <TextField label="Target Color" value={data.targetColor} placeholder="0xFF0000" onChange={v => updateData('targetColor', v)} />
            <NumberField label="Timeout (ms)" value={data.timeout || 5000} min={100} onChange={v => updateData('timeout', v)} />
        </BaseNode>
    );
}

export function WaitForImageNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="wait" icon="🖼️" title="Wait for Image">
            <TextField label="Image Path" value={data.imagePath} placeholder="images/button.png" onChange={v => updateData('imagePath', v)} />
            <NumberField label="Timeout (ms)" value={data.timeout || 5000} min={100} onChange={v => updateData('timeout', v)} />
        </BaseNode>
    );
}

// ========================================
// SCREEN INFO NODES
// ========================================

export function GetScreenResolutionNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="screen" icon="📐" title="Screen Resolution">
            <TextField label="Width Variable" value={data.widthVar || 'screenWidth'} onChange={v => updateData('widthVar', v)} />
            <TextField label="Height Variable" value={data.heightVar || 'screenHeight'} onChange={v => updateData('heightVar', v)} />
        </BaseNode>
    );
}

export function GetOrientationNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="screen" icon="🔄" title="Get Orientation">
            <TextField label="Store in Variable" value={data.variable || 'orientation'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function GetSNNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="screen" icon="🔢" title="Get Device SN">
            <TextField label="Store in Variable" value={data.variable || 'deviceSN'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function GetVersionNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="screen" icon="📋" title="Get AT Version">
            <TextField label="Store in Variable" value={data.variable || 'atVersion'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

// ========================================
// UTILITY NODES
// ========================================

export function LogNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="📋" title="Log">
            <TextField label="Message" value={data.message} placeholder="Log message..." onChange={v => updateData('message', v)} />
        </BaseNode>
    );
}

export function AlertNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="🔔" title="Alert">
            <TextField label="Message" value={data.message} placeholder="Alert message..." onChange={v => updateData('message', v)} />
        </BaseNode>
    );
}

export function ToastNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="💬" title="Toast">
            <TextField label="Message" value={data.message} placeholder="Toast message..." onChange={v => updateData('message', v)} />
            <NumberField label="Delay (s)" value={data.delay || 2} min={1} onChange={v => updateData('delay', v)} />
        </BaseNode>
    );
}

export function VibrateNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="📳" title="Vibrate">
            <div className="node-hint">vibrate()</div>
        </BaseNode>
    );
}

export function PlayAudioNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="🔊" title="Play Audio">
            <TextField label="Audio File" value={data.audioFile} placeholder="/path/to/audio.mp3" onChange={v => updateData('audioFile', v)} />
            <NumberField label="Times (0=infinite)" value={data.times || 1} min={0} onChange={v => updateData('times', v)} />
        </BaseNode>
    );
}

export function StopAudioNode({ id, data, selected }) {
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="🔇" title="Dừng âm thanh">
            <div className="node-hint">stopAudio()</div>
        </BaseNode>
    );
}

export function SetTimerNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="⏰" title="Đặt hẹn giờ">
            <TextField label="Đường dẫn script" value={data.scriptPath} placeholder="Records/test.lua" onChange={v => updateData('scriptPath', v)} />
            <TextField label="Thời gian kích hoạt" value={data.fireTime} placeholder="1000 hoặc 2025-01-30 08:00:00" onChange={v => updateData('fireTime', v)} />
            <NumberField label="Khoảng cách lặp (giây)" value={data.interval || 0} min={0} onChange={v => updateData('interval', v)} />
            <div className="node-options">
                <CheckboxField label="Lặp lại" checked={data.repeat} onChange={v => updateData('repeat', v)} />
            </div>
        </BaseNode>
    );
}

export function SetAutoLaunchNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="🚀" title="Tự động chạy">
            <TextField label="Đường dẫn script" value={data.scriptPath} placeholder="Records/test.lua" onChange={v => updateData('scriptPath', v)} />
            <div className="node-options">
                <CheckboxField label="Bật tự động chạy" checked={data.on} onChange={v => updateData('on', v)} />
            </div>
        </BaseNode>
    );
}

export function KeepAwakeNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="☕" title="Giữ thức">
            <div className="node-hint">Giữ AutoTouch không ngủ</div>
            <div className="node-options">
                <CheckboxField label="Giữ thức" checked={data.keepAwake} onChange={v => updateData('keepAwake', v)} />
            </div>
        </BaseNode>
    );
}

export function ExecuteNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="utility" icon="💻" title="Chạy lệnh">
            <TextAreaField label="Lệnh shell" value={data.command} placeholder="ls -la /" rows={2} onChange={v => updateData('command', v)} />
            <TextField label="Lưu kết quả vào" value={data.variable || 'result'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

// ========================================
// DATA & VARIABLE NODES
// ========================================

export function SetVariableNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="📦" title="Set Variable">
            <TextField label="Variable Name" value={data.name} placeholder="myVar" onChange={v => updateData('name', v)} />
            <TextField label="Value" value={data.value} placeholder="123 or 'text'" onChange={v => updateData('value', v)} />
        </BaseNode>
    );
}

export function MathNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="🔢" title="Math">
            <TextField label="Variable" value={data.variable || 'result'} onChange={v => updateData('variable', v)} />
            <TextField label="Expression" value={data.expression} placeholder="a + b * 2" onChange={v => updateData('expression', v)} />
        </BaseNode>
    );
}

export function IntToRgbNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="🎨" title="Int to RGB">
            <TextField label="Int Color" value={data.intColor} placeholder="color or 0xFF0000" onChange={v => updateData('intColor', v)} />
            <TextField label="R Variable" value={data.rVar || 'r'} onChange={v => updateData('rVar', v)} />
            <TextField label="G Variable" value={data.gVar || 'g'} onChange={v => updateData('gVar', v)} />
            <TextField label="B Variable" value={data.bVar || 'b'} onChange={v => updateData('bVar', v)} />
        </BaseNode>
    );
}

export function RgbToIntNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="🔢" title="RGB to Int">
            <TextField label="R" value={data.r} placeholder="255" onChange={v => updateData('r', v)} />
            <TextField label="G" value={data.g} placeholder="128" onChange={v => updateData('g', v)} />
            <TextField label="B" value={data.b} placeholder="0" onChange={v => updateData('b', v)} />
            <TextField label="Store in Variable" value={data.variable || 'intColor'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

export function CommentNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="💬" title="Comment">
            <TextAreaField label="Comment" value={data.comment} placeholder="Your comment..." onChange={v => updateData('comment', v)} />
        </BaseNode>
    );
}

export function EvalNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="data" icon="⚡" title="Custom Lua">
            <TextAreaField label="Lua Code" value={data.code} placeholder="-- Your Lua code here" rows={5} onChange={v => updateData('code', v)} />
        </BaseNode>
    );
}

// ========================================
// OCR NODE
// ========================================

export function OcrNode({ id, data, selected }) {
    const updateData = useNodeData(id);
    return (
        <BaseNode data={data} selected={selected} nodeType="ocr" icon="📖" title="Nhận dạng chữ (OCR)">
            <SelectField
                label="Phương thức"
                value={data.method || 'vision'}
                options={[
                    { value: 'vision', label: 'iOS Vision' },
                    { value: 'cloud', label: 'AI Cloud (Tesseract)' },
                ]}
                onChange={v => updateData('method', v)}
            />
            <TextField label="Vùng" value={data.region} placeholder="{x, y, width, height}" onChange={v => updateData('region', v)} />
            <TextField label="Ngôn ngữ" value={data.languages || 'en-US'} placeholder="en-US, fr-FR, vi-VN" onChange={v => updateData('languages', v)} />
            <TextField label="Whitelist" value={data.whitelist} placeholder="0123456789" onChange={v => updateData('whitelist', v)} />
            <NumberField label="Timeout (giây)" value={data.timeout || 10} min={1} max={60} onChange={v => updateData('timeout', v)} />
            <div className="node-options">
                <CheckboxField label="Debug" checked={data.debug} onChange={v => updateData('debug', v)} />
                <CheckboxField label="Sửa lỗi chính tả" checked={data.correct} onChange={v => updateData('correct', v)} />
            </div>
            <SelectField
                label="Độ ưu tiên"
                value={data.level || '0'}
                options={[
                    { value: '0', label: 'Chính xác' },
                    { value: '1', label: 'Tốc độ' },
                ]}
                onChange={v => updateData('level', v)}
            />
            <TextField label="Lưu vào biến" value={data.variable || 'ocrResult'} onChange={v => updateData('variable', v)} />
        </BaseNode>
    );
}

// ========================================
// NODE TYPES EXPORT
// ========================================
export const nodeTypes = {
    // Control Flow
    startNode: StartNode,
    ifNode: IfNode,
    ifElseNode: IfElseNode,
    whileNode: WhileNode,
    forNode: ForNode,
    forEachNode: ForEachNode,
    breakNode: BreakNode,
    stopNode: StopNode,

    // Touch
    tapNode: TapNode,
    touchDownNode: TouchDownNode,
    touchMoveNode: TouchMoveNode,
    touchUpNode: TouchUpNode,
    swipeNode: SwipeNode,
    longPressNode: LongPressNode,
    pinchNode: PinchNode,

    // Physical Keys
    pressHomeNode: PressHomeNode,
    pressPowerNode: PressPowerNode,
    pressVolumeUpNode: PressVolumeUpNode,
    pressVolumeDownNode: PressVolumeDownNode,
    lockScreenNode: LockScreenNode,
    unlockScreenNode: UnlockScreenNode,

    // Text Input
    inputTextNode: InputTextNode,
    copyTextNode: CopyTextNode,
    clipTextNode: ClipTextNode,

    // Color & Image
    coordinateNode: CoordinateNode,
    getColorNode: GetColorNode,
    getColorsNode: GetColorsNode,
    findColorNode: FindColorNode,
    findColorsNode: FindColorsNode,
    findImageNode: FindImageNode,
    screenshotNode: ScreenshotNode,

    // App Control
    appRunNode: AppRunNode,
    appKillNode: AppKillNode,
    appStateNode: AppStateNode,
    appInfoNode: AppInfoNode,
    frontMostAppNode: FrontMostAppNode,
    openUrlNode: OpenUrlNode,

    // Wait & Timing
    waitNode: WaitNode,
    waitForColorNode: WaitForColorNode,
    waitForImageNode: WaitForImageNode,

    // Screen Info
    getScreenResolutionNode: GetScreenResolutionNode,
    getOrientationNode: GetOrientationNode,
    getSNNode: GetSNNode,
    getVersionNode: GetVersionNode,

    // Utility
    logNode: LogNode,
    alertNode: AlertNode,
    toastNode: ToastNode,
    vibrateNode: VibrateNode,
    playAudioNode: PlayAudioNode,
    stopAudioNode: StopAudioNode,
    setTimerNode: SetTimerNode,
    setAutoLaunchNode: SetAutoLaunchNode,
    keepAwakeNode: KeepAwakeNode,
    executeNode: ExecuteNode,

    // Data & Variables
    setVariableNode: SetVariableNode,
    mathNode: MathNode,
    intToRgbNode: IntToRgbNode,
    rgbToIntNode: RgbToIntNode,
    commentNode: CommentNode,
    evalNode: EvalNode,

    // OCR
    ocrNode: OcrNode,
};

// Initial nodes for new scripts
export const initialNodes = [
    {
        id: 'start-1',
        type: 'startNode',
        position: { x: 250, y: 50 },
        data: {},
    },
];

export const initialEdges = [];
