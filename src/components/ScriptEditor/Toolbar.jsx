function Toolbar({
    scriptName,
    isRunning,
    onRun,
    onSave,
    onSaveAs,
    onExport,
    onLoad,
    onWorkLog,
    onDelete
}) {
    return (
        <div className="toolbar">
            <div className="toolbar-left">
                <span className="toolbar-script-name">📜 {scriptName}</span>
            </div>

            <div className="toolbar-center">
                <button
                    className={`toolbar-btn toolbar-btn-run ${isRunning ? 'running' : ''}`}
                    onClick={onRun}
                    disabled={isRunning}
                >
                    {isRunning ? '⏳' : '▶'} {isRunning ? 'Running...' : 'Start'}
                </button>

                <button className="toolbar-btn toolbar-btn-primary" onClick={onSave}>
                    💾 Save
                </button>

                <button className="toolbar-btn toolbar-btn-primary" onClick={onSaveAs}>
                    📄 Save as
                </button>

                <button className="toolbar-btn toolbar-btn-secondary" onClick={onLoad}>
                    📂 Load
                </button>

                <button className="toolbar-btn toolbar-btn-secondary" onClick={onExport}>
                    📤 Export
                </button>

                <button className="toolbar-btn toolbar-btn-secondary" onClick={onWorkLog}>
                    📋 Work log
                </button>

                <button className="toolbar-btn toolbar-btn-danger" onClick={onDelete}>
                    🗑️ Delete
                </button>
            </div>

            <div className="toolbar-right">
                {/* Future: Device connection status */}
            </div>
        </div>
    );
}

export default Toolbar;
