import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ManageIPTab from './components/ManageIP/ManageIPTab';
import ScriptEditorTab from './components/ScriptEditor/ScriptEditorTab';
import AIVisionAgent from './components/AIVisionAgent';

function App() {
    const [activeTab, setActiveTab] = useState('manageip');
    const [selectedDevice, setSelectedDevice] = useState(null);

    return (
        <div className="app">
            {/* Title Bar Drag Region */}
            <div className="titlebar">
                <div className="titlebar-drag">
                    <span className="app-logo">🍎</span>
                    <span className="app-title">AutoTouch Builder</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === 'manageip' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manageip')}
                >
                    <span className="tab-icon">📱</span>
                    Manage IP
                </button>
                <button
                    className={`tab-btn ${activeTab === 'script' ? 'active' : ''}`}
                    onClick={() => setActiveTab('script')}
                >
                    <span className="tab-icon">🔗</span>
                    Script Editor
                </button>
                <button
                    className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai')}
                >
                    <span className="tab-icon">🤖</span>
                    AI Vision
                </button>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {activeTab === 'manageip' && (
                    <ManageIPTab
                        onDeviceSelect={setSelectedDevice}
                        selectedDevice={selectedDevice}
                    />
                )}
                {activeTab === 'script' && (
                    <ReactFlowProvider>
                        <ScriptEditorTab selectedDevice={selectedDevice} />
                    </ReactFlowProvider>
                )}
                {activeTab === 'ai' && (
                    <AIVisionAgent selectedDevice={selectedDevice} />
                )}
            </div>

            {/* Status Bar */}
            <div className="status-bar">
                <div className="status-left">
                    <span className="status-item">
                        <span className="status-dot online"></span>
                        Connected: 0 devices
                    </span>
                </div>
                <div className="status-right">
                    <span className="status-item">Script: Untitled.lua</span>
                    <span className="status-item">v1.0.0</span>
                </div>
            </div>
        </div>
    );
}

export default App;
