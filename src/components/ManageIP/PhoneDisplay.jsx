import { useEffect, useState } from 'react';
import { VncScreen } from 'react-vnc';

// VNC Viewer Component Wrapper
function VncViewer({ device }) {
    const [vncUrl, setVncUrl] = useState(null);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Initializing...');

    useEffect(() => {
        let isMounted = true;
        setVncUrl(null);
        setError(null);
        setStatus('Starting Proxy...');

        const startProxy = async () => {
            if (!window.electronAPI) {
                setError('Electron API missing');
                return;
            }

            try {
                const result = await window.electronAPI.startVncProxy({
                    deviceId: device.id,
                    targetIp: device.ip,
                    targetPort: 5900
                });

                if (isMounted) {
                    if (result.success) {
                        setVncUrl(`ws://localhost:${result.port}`);
                        setStatus('Ready');
                    } else {
                        setError(result.error || 'Proxy Start Failed');
                    }
                }
            } catch (err) {
                if (isMounted) setError(err.message);
            }
        };

        startProxy();
        return () => { isMounted = false; };
    }, [device.id, device.ip]);

    if (error) {
        return (
            <div className="vnc-error" style={{ color: '#ff6b6b', padding: 20, textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
                <span style={{ fontSize: '2em' }}>⚠️</span>
                <p style={{ margin: '10px 0 5px' }}>Connection Error</p>
                <small style={{ opacity: 0.7 }}>{error}</small>
            </div>
        );
    }

    if (!vncUrl) {
        return (
            <div className="vnc-loading" style={{ color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#0a0a15' }}>
                <div className="spinner"></div>
                <p style={{ marginTop: 15, opacity: 0.8 }}>{status}</p>
            </div>
        );
    }

    return (
        <div className="vnc-container" style={{ width: '100%', height: '100%', background: '#000' }}>
            <VncScreen
                url={vncUrl}
                scaleViewport={true}
                background="#000000"
                style={{ width: '100%', height: '100%' }}
                retryDuration={3000}
                qualityLevel={3}
                compressionLevel={9}
                onDisconnect={() => console.log('VNC Disconnected')}
                onError={(err) => console.error('VNC Error', err)}
            />
        </div>
    );
}

// Phone Thumbnail (Small Phone in Grid) - Live VNC
function PhoneThumbnail({ device, isSelected, onClick }) {
    return (
        <div
            className={`phone-thumbnail ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            style={{
                width: '100%',
                aspectRatio: '9/16',
                background: isSelected ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#1a1a2e',
                borderRadius: 12,
                overflow: 'hidden',
                cursor: 'pointer',
                border: isSelected ? '3px solid #667eea' : '2px solid #333',
                transition: 'all 0.2s ease',
                position: 'relative',
            }}
        >
            {/* Live VNC Preview */}
            <div style={{ width: '100%', height: '100%' }}>
                {device.status === 'connected' ? (
                    <VncViewer device={device} />
                ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#666' }}>
                        <div>
                            <span style={{ fontSize: '1.5em' }}>📵</span>
                            <p style={{ fontSize: '0.7em', marginTop: 5 }}>Offline</p>
                        </div>
                    </div>
                )}
            </div>
            {/* Device Name Label */}
            <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
                padding: '20px 8px 8px',
                color: '#fff',
                fontSize: '0.75em',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
                {device.name}
            </div>
        </div>
    );
}

// Main Phone Display Component (Phone Farm Layout)
function PhoneDisplay({ devices, selectedDevice, onSelect }) {
    // All devices (connected and disconnected for grid)
    const allDevices = devices;

    // Device to show in main view
    const mainDevice = selectedDevice || allDevices.find(d => d.status === 'connected') || allDevices[0];

    if (allDevices.length === 0) {
        return (
            <div className="content-area">
                <div className="empty-state">
                    <span className="empty-state-icon">📱</span>
                    <h3 className="empty-state-title">No Devices</h3>
                    <p className="empty-state-text">
                        Add devices from the sidebar to manage your phone farm
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="content-area" style={{ display: 'flex', gap: 20, padding: 20 }}>
            {/* LEFT: Main Phone (Large) */}
            <div className="main-phone-container" style={{
                flex: '0 0 480px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div className="phone-frame-large" style={{
                    width: '100%',
                    maxWidth: 480,
                    aspectRatio: '9/19.5',
                    background: '#0c0c14',
                    borderRadius: 40,
                    padding: 8,
                    boxShadow: '0 25px 50px rgba(0,0,0,0.5), inset 0 0 0 2px #333',
                    overflow: 'hidden',
                }}>
                    <div className="phone-screen-large" style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: 32,
                        overflow: 'hidden',
                        background: '#000',
                    }}>
                        {mainDevice ? (
                            mainDevice.status === 'connected' ? (
                                <VncViewer device={mainDevice} />
                            ) : (
                                <div style={{
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexDirection: 'column',
                                    background: '#1a1a2e',
                                    color: '#666',
                                }}>
                                    <span style={{ fontSize: '3em' }}>📵</span>
                                    <p style={{ marginTop: 15 }}>Device Offline</p>
                                    <small style={{ opacity: 0.6 }}>Tap Connect in sidebar</small>
                                </div>
                            )
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                                Select a device
                            </div>
                        )}
                    </div>
                </div>
                {/* Device Info */}
                {mainDevice && (
                    <div style={{ marginTop: 15, textAlign: 'center' }}>
                        <h3 style={{ color: '#fff', margin: 0, fontSize: '1.1em' }}>{mainDevice.name}</h3>
                        <p style={{ color: '#888', margin: '5px 0 0', fontSize: '0.85em' }}>{mainDevice.ip}</p>
                        <span style={{
                            display: 'inline-block',
                            marginTop: 8,
                            padding: '4px 12px',
                            borderRadius: 20,
                            fontSize: '0.75em',
                            background: mainDevice.status === 'connected' ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255,255,255,0.05)',
                            color: mainDevice.status === 'connected' ? '#00ff88' : '#666',
                        }}>
                            {mainDevice.status === 'connected' ? '● Online' : '○ Offline'}
                        </span>
                    </div>
                )}
            </div>

            {/* RIGHT: Phone Grid (Thumbnails) */}
            <div className="phone-grid-container" style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
            }}>
                <h4 style={{ color: '#888', margin: '0 0 15px', fontSize: '0.9em', fontWeight: 500 }}>
                    ALL DEVICES ({allDevices.length})
                </h4>
                <div className="phone-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: 20,
                    overflowY: 'auto',
                    paddingRight: 10,
                }}>
                    {allDevices.map(device => (
                        <PhoneThumbnail
                            key={device.id}
                            device={device}
                            isSelected={mainDevice?.id === device.id}
                            onClick={() => onSelect(device)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PhoneDisplay;
