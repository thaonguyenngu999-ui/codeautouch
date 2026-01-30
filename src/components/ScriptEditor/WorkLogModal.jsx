import { useState, useEffect } from 'react';
import { workLogDB } from '../../utils/scriptDB';

function WorkLogModal({ onClose }) {
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        setLogs(workLogDB.getAll());
    }, []);

    const handleClear = () => {
        if (confirm('Clear all work logs?')) {
            workLogDB.clear();
            setLogs([]);
        }
    };

    const formatDate = (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'run': return '▶️';
            case 'save': return '💾';
            case 'export': return '📤';
            case 'delete': return '🗑️';
            default: return '📝';
        }
    };

    const getStatusColor = (status) => {
        return status === 'success' ? 'var(--success)' : 'var(--error)';
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">📋 Work Log</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {logs.length === 0 ? (
                        <div className="empty-state" style={{ padding: 40 }}>
                            <span className="empty-state-icon">📋</span>
                            <h3 className="empty-state-title">No logs yet</h3>
                            <p className="empty-state-text">Your work history will appear here</p>
                        </div>
                    ) : (
                        <div className="work-log-list">
                            {logs.map(log => (
                                <div key={log.id} className="work-log-item">
                                    <div className="work-log-icon">{getActionIcon(log.action)}</div>
                                    <div className="work-log-info">
                                        <div className="work-log-title">
                                            <span style={{ color: getStatusColor(log.status) }}>●</span>
                                            {' '}{log.action.toUpperCase()} - {log.scriptName}
                                        </div>
                                        {log.message && (
                                            <div className="work-log-message">{log.message}</div>
                                        )}
                                        <div className="work-log-time">{formatDate(log.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={handleClear}>
                        🗑️ Clear All
                    </button>
                    <button className="btn btn-primary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WorkLogModal;
