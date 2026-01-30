import { useState } from 'react';

function IPList({ devices, selectedDevice, onSelect, onAdd, onRemove, onToggleConnect }) {
    const [newIP, setNewIP] = useState('');
    const [newName, setNewName] = useState('');

    const handleAdd = () => {
        if (newIP.trim()) {
            onAdd(newIP.trim(), newName.trim());
            setNewIP('');
            setNewName('');
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            handleAdd();
        }
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h3 className="sidebar-title">📱 Device List</h3>
                <div className="input-group">
                    <input
                        type="text"
                        className="input"
                        placeholder="IP Address"
                        value={newIP}
                        onChange={(e) => setNewIP(e.target.value)}
                        onKeyDown={handleKeyPress}
                    />
                </div>
                <div className="input-group" style={{ marginTop: 8 }}>
                    <input
                        type="text"
                        className="input"
                        placeholder="Device Name (optional)"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={handleKeyPress}
                    />
                    <button className="btn btn-primary btn-icon" onClick={handleAdd}>+</button>
                </div>
            </div>

            <div className="sidebar-content">
                {devices.length === 0 ? (
                    <div className="empty-state" style={{ padding: 20 }}>
                        <span className="empty-state-icon">📵</span>
                        <p className="empty-state-text">No devices added yet</p>
                    </div>
                ) : (
                    devices.map((device) => (
                        <div
                            key={device.id}
                            className={`card ${selectedDevice?.id === device.id ? 'active' : ''}`}
                            onClick={() => onSelect(device)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
                                        {device.name}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {device.ip}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                        className={`btn btn-icon btn-secondary`}
                                        style={{ width: 28, height: 28, fontSize: 12 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleConnect(device.id);
                                        }}
                                        title={device.status === 'connected' ? 'Disconnect' : 'Connect'}
                                    >
                                        {device.status === 'connected' ? '🔌' : '▶️'}
                                    </button>
                                    <button
                                        className="btn btn-icon btn-secondary"
                                        style={{ width: 28, height: 28, fontSize: 12 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRemove(device.id);
                                        }}
                                        title="Remove"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginTop: 8 }}>
                                <span
                                    className={`phone-status-badge ${device.status === 'connected' ? 'connected' : ''}`}
                                >
                                    <span
                                        className="status-dot"
                                        style={{
                                            background: device.status === 'connected' ? 'var(--success)' : 'var(--text-muted)',
                                            width: 5,
                                            height: 5
                                        }}
                                    ></span>
                                    {device.status === 'connected' ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default IPList;
