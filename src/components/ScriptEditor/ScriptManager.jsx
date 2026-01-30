import { useState, useEffect } from 'react';
import { scriptDB } from '../../utils/scriptDB';
import './ScriptManager.css';

// Modal tạo kịch bản mới
function CreateScriptModal({ isOpen, onClose, onCreate }) {
    const [name, setName] = useState('');
    const [folder, setFolder] = useState('');

    const handleCreate = () => {
        if (name.trim()) {
            onCreate({ name: name.trim(), folder: folder.trim() || 'Mặc định' });
            setName('');
            setFolder('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>➕ Tạo Kịch Bản Mới</h2>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>
                <div className="modal-body">
                    <div className="form-field">
                        <label>Tên kịch bản</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Nhập tên kịch bản..."
                            autoFocus
                        />
                    </div>
                    <div className="form-field">
                        <label>Thư mục (tùy chọn)</label>
                        <input
                            type="text"
                            value={folder}
                            onChange={e => setFolder(e.target.value)}
                            placeholder="Mặc định"
                        />
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>Hủy</button>
                    <button className="btn-primary" onClick={handleCreate} disabled={!name.trim()}>
                        ✓ Tạo Kịch Bản
                    </button>
                </div>
            </div>
        </div>
    );
}

// Card hiển thị mỗi kịch bản
function ScriptCard({ script, onEdit, onDuplicate, onExport, onRun, onDelete }) {
    const formatDate = (dateStr) => {
        if (!dateStr) return 'Chưa rõ';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="script-card">
            <div className="script-card-header">
                <input type="checkbox" className="script-checkbox" />
                <span className="script-name">{script.name}</span>
                {script.status === 'running' && <span className="status-badge running">Đang chạy</span>}
                {script.status === 'paused' && <span className="status-badge paused">Tạm dừng</span>}
            </div>
            <div className="script-card-body">
                <div className="script-info">
                    <span className="info-label">Thời gian tạo</span>
                    <span className="info-value">{formatDate(script.createdAt)}</span>
                </div>
            </div>
            <div className="script-card-footer">
                <div className="script-actions-left">
                    <button className="action-btn" title="Xem mã" onClick={() => onEdit(script)}>📋</button>
                    <button className="action-btn" title="Sao chép" onClick={() => onDuplicate(script)}>📄</button>
                    <button className="action-btn" title="Chỉnh sửa" onClick={() => onEdit(script)}>✏️</button>
                    <button className="action-btn delete" title="Xóa" onClick={() => onDelete(script)}>🗑️</button>
                </div>
                <div className="script-actions-right">
                    {script.status === 'running' ? (
                        <button className="btn-stop">⏹️ Dừng</button>
                    ) : (
                        <button className="btn-run" onClick={() => onRun(script)}>▶️ Chạy</button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ScriptManager({ onEditScript }) {
    const [scripts, setScripts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [folderFilter, setFolderFilter] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [folders, setFolders] = useState(['Mặc định']);

    // Load danh sách kịch bản
    useEffect(() => {
        loadScripts();
    }, []);

    const loadScripts = () => {
        const savedScripts = scriptDB.getAll();
        setScripts(savedScripts);

        // Lấy danh sách thư mục
        const uniqueFolders = [...new Set(savedScripts.map(s => s.folder || 'Mặc định'))];
        setFolders(uniqueFolders.length > 0 ? uniqueFolders : ['Mặc định']);
    };

    const handleCreateScript = ({ name, folder }) => {
        const newScript = {
            id: Date.now().toString(),
            name,
            folder,
            nodes: [
                {
                    id: 'start-1',
                    type: 'startNode',
                    position: { x: 250, y: 50 },
                    data: {},
                }
            ],
            edges: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        scriptDB.save(newScript);
        loadScripts();
        onEditScript(newScript);
    };

    const handleEditScript = (script) => {
        onEditScript(script);
    };

    const handleDuplicateScript = (script) => {
        const newScript = {
            ...script,
            id: Date.now().toString(),
            name: script.name + ' (Bản sao)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        scriptDB.save(newScript);
        loadScripts();
    };

    const handleDeleteScript = (script) => {
        if (confirm(`Bạn có chắc muốn xóa kịch bản "${script.name}"?`)) {
            scriptDB.delete(script.id);
            loadScripts();
        }
    };

    const handleRunScript = (script) => {
        alert(`Chạy kịch bản: ${script.name}\n(Tính năng này cần kết nối với thiết bị iOS)`);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        if (imported.name) {
                            imported.id = Date.now().toString();
                            imported.createdAt = new Date().toISOString();
                            scriptDB.save(imported);
                            loadScripts();
                        }
                    } catch (err) {
                        alert('Lỗi khi nhập file: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleCreateFolder = () => {
        const name = prompt('Nhập tên thư mục mới:');
        if (name && name.trim()) {
            setFolders([...folders, name.trim()]);
        }
    };

    // Lọc kịch bản
    const filteredScripts = scripts.filter(script => {
        const matchSearch = script.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchFolder = !folderFilter || (script.folder || 'Mặc định') === folderFilter;
        return matchSearch && matchFolder;
    });

    return (
        <div className="script-manager">
            {/* Header */}
            <div className="manager-header">
                <div className="header-tabs">
                    <button className="tab active">Kịch bản</button>
                    <button className="tab">Nút Tùy Chỉnh</button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="manager-toolbar">
                <div className="search-box">
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo tên..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <button className="btn-search">Tìm kiếm...</button>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="manager-actions">
                <button className="btn-action blue" onClick={() => alert('Tải lại từ điện thoại')}>
                    📥 Tải lại từ điện thoại
                </button>
                <button className="btn-action green" onClick={() => setShowCreateModal(true)}>
                    ➕ Tạo kịch bản
                </button>
                <button className="btn-action orange" onClick={handleImport}>
                    📂 Nhập tập tin
                </button>
                <button className="btn-action purple" onClick={handleCreateFolder}>
                    📁 Thêm vào thư mục
                </button>
            </div>

            {/* Folder Filter */}
            <div className="folder-section">
                <div className="folder-tabs">
                    <button
                        className={`folder-tab ${!folderFilter ? 'active' : ''}`}
                        onClick={() => setFolderFilter('')}
                    >
                        Tất cả
                    </button>
                    {folders.map(folder => (
                        <button
                            key={folder}
                            className={`folder-tab ${folderFilter === folder ? 'active' : ''}`}
                            onClick={() => setFolderFilter(folder)}
                        >
                            {folder}
                        </button>
                    ))}
                </div>
                <div className="folder-search">
                    <input type="text" placeholder="Tìm kiếm kịch bản theo tên" />
                    <button className="btn-search">Tìm kiếm...</button>
                </div>
            </div>

            {/* Select All */}
            <div className="select-all">
                <label>
                    <input type="checkbox" />
                    Chọn tất cả
                </label>
            </div>

            {/* Selection Toolbar - Shows when script is selected */}
            <div className="selection-toolbar" style={{
                display: 'flex',
                gap: 10,
                padding: '12px 20px',
                background: '#16161e',
                borderRadius: 8,
                marginBottom: 15,
            }}>
                <button
                    className="toolbar-btn start"
                    style={{
                        padding: '8px 20px',
                        borderRadius: 6,
                        border: '1px solid #22c55e',
                        background: 'transparent',
                        color: '#22c55e',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontWeight: 500,
                    }}
                    onClick={() => alert('Start script - Chọn script để chạy')}
                >
                    ▷ Start
                </button>
                <button
                    className="toolbar-btn"
                    style={{
                        padding: '8px 20px',
                        borderRadius: 6,
                        border: '1px solid #3b82f6',
                        background: 'transparent',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                    onClick={() => alert('Save')}
                >
                    📄 Save
                </button>
                <button
                    className="toolbar-btn"
                    style={{
                        padding: '8px 20px',
                        borderRadius: 6,
                        border: '1px solid #3b82f6',
                        background: 'transparent',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                    onClick={() => alert('Save as')}
                >
                    📋 Save as
                </button>
                <button
                    className="toolbar-btn"
                    style={{
                        padding: '8px 20px',
                        borderRadius: 6,
                        border: '1px solid #3b82f6',
                        background: 'transparent',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                    onClick={() => alert('Work log')}
                >
                    📋 Work log
                </button>
                <button
                    className="toolbar-btn delete"
                    style={{
                        padding: '8px 20px',
                        borderRadius: 6,
                        border: '1px solid #ef4444',
                        background: 'transparent',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}
                    onClick={() => alert('Delete - Chọn script để xóa')}
                >
                    🗑 Delete
                </button>
            </div>

            {/* Script Grid */}
            <div className="script-grid">
                {filteredScripts.length === 0 ? (
                    <div className="empty-state">
                        <p>Chưa có kịch bản nào.</p>
                        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                            ➕ Tạo Kịch Bản Đầu Tiên
                        </button>
                    </div>
                ) : (
                    filteredScripts.map(script => (
                        <ScriptCard
                            key={script.id}
                            script={script}
                            onEdit={handleEditScript}
                            onDuplicate={handleDuplicateScript}
                            onExport={() => { }}
                            onRun={handleRunScript}
                            onDelete={handleDeleteScript}
                        />
                    ))
                )}
            </div>

            {/* Create Modal */}
            <CreateScriptModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreateScript}
            />
        </div>
    );
}
