import { useState, useEffect, useRef, useCallback } from 'react';
import { VncScreen } from 'react-vnc';

const STORAGE_KEY = 'autotouch_devices';

// Load devices from localStorage
const loadDevices = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('Failed to load devices:', e);
    }
    return [];
};

// Interactive Phone Component for Script Editor
function InteractivePhone({ onTap, onSwipe, onColorCapture, onCoordCapture, onDeviceChange }) {
    const [devices, setDevices] = useState(loadDevices);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [vncUrl, setVncUrl] = useState(null);
    const [status, setStatus] = useState('Select a device');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureMode, setCaptureMode] = useState('tap'); // 'tap', 'color', 'coord', 'colors'
    const [multiPoints, setMultiPoints] = useState([]); // For multi-color capture
    const [isFetchingColor, setIsFetchingColor] = useState(false);
    const containerRef = useRef(null);
    const swipeStartRef = useRef(null);
    const [screenSize, setScreenSize] = useState({ width: 750, height: 1334 }); // Default to iPhone 6/7/8

    // Auto-select first connected device
    useEffect(() => {
        const connected = devices.find(d => d.status === 'connected');
        if (connected && !selectedDevice) {
            setSelectedDevice(connected);
            onDeviceChange?.(connected);
        }
    }, [devices, selectedDevice, onDeviceChange]);

    // Fetch device screen resolution
    useEffect(() => {
        if (!selectedDevice || !window.electronAPI) return;

        const fetchScreenSize = async () => {
            try {
                const result = await window.electronAPI.getDeviceScreen(selectedDevice.ip);
                if (result.success) {
                    console.log(`📱 Device Resolution: ${result.width}x${result.height}`);
                    setScreenSize({ width: result.width, height: result.height });
                }
            } catch (err) {
                console.warn('Failed to fetch screen size:', err);
            }
        };

        fetchScreenSize();
    }, [selectedDevice]);

    // Start VNC proxy when device selected
    useEffect(() => {
        if (!selectedDevice || !window.electronAPI) {
            setVncUrl(null);
            setStatus(selectedDevice ? 'Connecting...' : 'Select a device');
            return;
        }

        let isMounted = true;
        const startProxy = async () => {
            setStatus('Starting proxy...');
            try {
                const result = await window.electronAPI.startVncProxy({
                    deviceId: `editor_${selectedDevice.id}`,
                    targetIp: selectedDevice.ip,
                    targetPort: 5900
                });

                if (isMounted) {
                    if (result.success) {
                        setVncUrl(`ws://localhost:${result.port}`);
                        setStatus('Connected');
                    } else {
                        setStatus(`Error: ${result.error}`);
                    }
                }
            } catch (err) {
                if (isMounted) setStatus(`Error: ${err.message}`);
            }
        };

        startProxy();
        return () => { isMounted = false; };
    }, [selectedDevice]);

    const fetchColor = useCallback(async (x, y, isMulti = false) => {
        if (!selectedDevice || isFetchingColor) return;

        setIsFetchingColor(true);
        try {
            // Ensure coordinates are within bounds
            const safeX = Math.min(Math.max(0, x), screenSize.width - 1);
            const safeY = Math.min(Math.max(0, y), screenSize.height - 1);

            const result = await window.electronAPI.getColorOnDevice({
                deviceIp: selectedDevice.ip,
                x: Math.round(safeX),
                y: Math.round(safeY)
            });

            let color;
            if (result.success) {
                color = result.color;
            } else {
                // Fallback to picking color from the local VNC canvas
                console.warn(`API color failed: ${result.error}. Trying canvas pick...`);
                const canvas = containerRef.current.querySelector('canvas');
                if (canvas) {
                    try {
                        const ctx = canvas.getContext('2d', { willReadFrequently: true });
                        const rect = canvas.getBoundingClientRect();
                        const clickX = (safeX / screenSize.width) * canvas.width;
                        const clickY = (safeY / screenSize.height) * canvas.height;

                        const pixel = ctx.getImageData(clickX, clickY, 1, 1).data;
                        const r = pixel[0].toString(16).padStart(2, '0');
                        const g = pixel[1].toString(16).padStart(2, '0');
                        const b = pixel[2].toString(16).padStart(2, '0');
                        color = `0x${r}${g}${b}`.toUpperCase();
                    } catch (err) {
                        console.error('Canvas pick failed:', err);
                        color = null; // Indicate failure
                    }
                }
            }

            if (color) {
                if (isMulti) {
                    setMultiPoints(prev => [...prev, { x: safeX, y: safeY, color }]);
                } else {
                    onColorCapture?.({ x: safeX, y: safeY, color, deviceIp: selectedDevice.ip });
                    setIsCapturing(false); // Stop capturing after single color
                }
            }
        } catch (err) {
            console.error('IPC get color error:', err);
        } finally {
            setIsFetchingColor(false);
        }
    }, [selectedDevice, isFetchingColor, onColorCapture, screenSize]);

    const handleFinishMultiColor = useCallback(() => {
        if (multiPoints.length > 0) {
            onColorCapture?.({ points: multiPoints, deviceIp: selectedDevice?.ip });
            setMultiPoints([]);
            setIsCapturing(false);
        }
    }, [multiPoints, onColorCapture, selectedDevice]);

    // Handle click on VNC screen
    // Helper to map screen coordinates accounting for "object-fit: contain" letterboxing
    const mapCoordinates = useCallback((clientX, clientY) => {
        if (!containerRef.current) return { x: 0, y: 0 };

        const rect = containerRef.current.getBoundingClientRect();
        const containerRatio = rect.width / rect.height;
        const deviceRatio = screenSize.width / screenSize.height;

        let renderedWidth, renderedHeight, offsetX, offsetY;

        if (containerRatio > deviceRatio) {
            // Container is wider - Pillarboxing (black bars on sides)
            renderedHeight = rect.height;
            renderedWidth = rect.height * deviceRatio;
            offsetX = (rect.width - renderedWidth) / 2;
            offsetY = 0;
        } else {
            // Container is taller - Letterboxing (black bars on top/bottom)
            renderedWidth = rect.width;
            renderedHeight = rect.width / deviceRatio;
            offsetX = 0;
            offsetY = (rect.height - renderedHeight) / 2;
        }

        const relativeX = clientX - rect.left - offsetX;
        const relativeY = clientY - rect.top - offsetY;

        // Map to device coordinates
        const x = (relativeX / renderedWidth) * screenSize.width;
        const y = (relativeY / renderedHeight) * screenSize.height;

        // Clamp to valid range
        return {
            x: Number(Math.min(Math.max(0, x), screenSize.width).toFixed(2)),
            y: Number(Math.min(Math.max(0, y), screenSize.height).toFixed(2))
        };
    }, [screenSize]);

    // Handle click on VNC screen
    const handleClick = useCallback((e) => {
        if (!isCapturing || !containerRef.current) return;

        const { x, y } = mapCoordinates(e.clientX, e.clientY);

        if (captureMode === 'tap') {
            onTap?.({ x, y, deviceIp: selectedDevice?.ip });
            console.log(`Captured tap at (${x}, ${y})`);
            setIsCapturing(false); // Stop capturing after single tap
        } else if (captureMode === 'color') {
            fetchColor(x, y);
        } else if (captureMode === 'colors') {
            fetchColor(x, y, true); // true means multi-mode
        } else if (captureMode === 'coord') {
            onCoordCapture?.({ x, y, deviceIp: selectedDevice?.ip });
            console.log(`Captured coordinate at (${x}, ${y})`);
            setIsCapturing(false); // Stop capturing after single coord
        }
    }, [isCapturing, captureMode, selectedDevice, onTap, onCoordCapture, fetchColor, mapCoordinates]);

    // Handle swipe (mouse down/up)
    const handleMouseDown = (e) => {
        if (!isCapturing || captureMode !== 'swipe' || !containerRef.current) return;
        swipeStartRef.current = mapCoordinates(e.clientX, e.clientY);
    };

    const handleMouseUp = (e) => {
        if (!isCapturing || captureMode !== 'swipe' || !swipeStartRef.current || !containerRef.current) return;

        const endCoords = mapCoordinates(e.clientX, e.clientY);
        const start = swipeStartRef.current;

        onSwipe?.({
            startX: start.x,
            startY: start.y,
            endX: endCoords.x,
            endY: endCoords.y,
            deviceIp: selectedDevice?.ip
        });
        console.log(`Captured swipe from (${start.x}, ${start.y}) to (${endCoords.x}, ${endCoords.y})`);
        swipeStartRef.current = null;
        setIsCapturing(false); // Stop capturing after single swipe
    };

    return (
        <div className="interactive-phone" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: '#12121a',
            borderLeft: '1px solid #333',
            minWidth: 320,
            maxWidth: 400,
        }}>
            {/* Header - 20% with scroll */}
            <div style={{
                height: '20%',
                minHeight: 120,
                padding: '10px 12px',
                borderBottom: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                overflowY: 'auto',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9em' }}>📱 iPhone Live</span>
                    <span style={{
                        fontSize: '0.7em',
                        padding: '3px 8px',
                        borderRadius: 10,
                        background: status === 'Connected' ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                        color: status === 'Connected' ? '#00ff88' : '#888',
                    }}>
                        {status}
                    </span>
                </div>

                {/* Device Selector */}
                <select
                    value={selectedDevice?.id || ''}
                    onChange={(e) => {
                        const device = devices.find(d => d.id === Number(e.target.value));
                        setSelectedDevice(device);
                        onDeviceChange?.(device);
                    }}
                    style={{
                        background: '#1a1a25',
                        border: '1px solid #333',
                        color: '#fff',
                        padding: '8px 10px',
                        borderRadius: 6,
                        fontSize: '0.85em',
                        cursor: 'pointer',
                    }}
                >
                    <option value="">-- Chọn thiết bị --</option>
                    {devices.map(d => (
                        <option key={d.id} value={d.id}>
                            {d.name} ({d.ip})
                        </option>
                    ))}
                </select>

                {/* Capture Controls */}
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { setIsCapturing(!isCapturing); setMultiPoints([]); }}
                        style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: 6,
                            border: 'none',
                            background: isCapturing ? '#ef4444' : 'linear-gradient(135deg, #667eea, #764ba2)',
                            color: '#fff',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.8em',
                        }}
                    >
                        {isCapturing ? '🔴 Dừng Capture' : '🎯 Bắt đầu Capture'}
                    </button>
                </div>

                {/* Multi-point indicator */}
                {isCapturing && captureMode === 'colors' && multiPoints.length > 0 && (
                    <div style={{ padding: '8px', background: '#1a1a25', borderRadius: 6, marginBottom: 8, fontSize: '11px', border: '1px solid #333', color: '#fff' }}>
                        <div style={{ color: '#f6ad55', fontWeight: 'bold', marginBottom: 4 }}>Đã chọn {multiPoints.length} điểm:</div>
                        <div style={{ maxHeight: 60, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {multiPoints.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }}></span>
                                    <span>P{i + 1}: {p.color} ({p.x}, {p.y})</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleFinishMultiColor}
                            style={{ width: '100%', marginTop: 8, padding: '4px', background: '#f6ad55', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                        >
                            Xong (Tạo FindColors)
                        </button>
                    </div>
                )}

                {/* Capture Mode */}
                {isCapturing && (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => { setCaptureMode('tap'); setMultiPoints([]); }}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 6,
                                border: captureMode === 'tap' ? '2px solid #667eea' : '1px solid #333',
                                background: captureMode === 'tap' ? 'rgba(102,126,234,0.2)' : '#1a1a25',
                                color: captureMode === 'tap' ? '#667eea' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                            }}
                        >
                            👆 Chạm
                        </button>
                        <button
                            onClick={() => { setCaptureMode('swipe'); setMultiPoints([]); }}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 6,
                                border: captureMode === 'swipe' ? '2px solid #3b82f6' : '1px solid #333',
                                background: captureMode === 'swipe' ? 'rgba(59,130,246,0.2)' : '#1a1a25',
                                color: captureMode === 'swipe' ? '#3b82f6' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                            }}
                        >
                            👉 Vuốt
                        </button>
                        <button
                            onClick={() => { setCaptureMode('color'); setMultiPoints([]); }}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 6,
                                border: captureMode === 'color' ? '2px solid #10b981' : '1px solid #333',
                                background: captureMode === 'color' ? 'rgba(16,185,129,0.2)' : '#1a1a25',
                                color: captureMode === 'color' ? '#10b981' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                            }}
                        >
                            🎨 Màu
                        </button>
                        <button
                            onClick={() => { setCaptureMode('colors'); setMultiPoints([]); }}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 6,
                                border: captureMode === 'colors' ? '2px solid #f6ad55' : '1px solid #333',
                                background: captureMode === 'colors' ? 'rgba(246,173,85,0.2)' : '#1a1a25',
                                color: captureMode === 'colors' ? '#f6ad55' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                            }}
                        >
                            🌈 Nhiều
                        </button>
                        <button
                            onClick={() => { setCaptureMode('coord'); setMultiPoints([]); }}
                            style={{
                                flex: 1,
                                padding: '6px',
                                borderRadius: 6,
                                border: captureMode === 'coord' ? '2px solid #8b5cf6' : '1px solid #333',
                                background: captureMode === 'coord' ? 'rgba(139,92,246,0.2)' : '#1a1a25',
                                color: captureMode === 'coord' ? '#8b5cf6' : '#888',
                                cursor: 'pointer',
                                fontSize: '0.75em',
                            }}
                        >
                            📍 Tọa độ
                        </button>
                    </div>
                )}
            </div>

            {/* VNC Screen - Fixed 80% height */}
            <div
                ref={containerRef}
                style={{
                    height: '80%',
                    position: 'relative',
                    cursor: isCapturing ? 'crosshair' : 'default',
                    background: '#000',
                }}
            >
                {vncUrl ? (
                    <VncScreen
                        url={vncUrl}
                        scaleViewport={true}
                        background="#000000"
                        style={{ width: '100%', height: '100%' }}
                        qualityLevel={9}
                        compressionLevel={0}
                    />
                ) : (
                    <div style={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#666',
                        flexDirection: 'column',
                        gap: 10,
                    }}>
                        <span style={{ fontSize: '3em' }}>📱</span>
                        <p>Chọn thiết bị để xem màn hình</p>
                    </div>
                )}

                {/* Capture Click Overlay - Captures clicks when in capture mode */}
                {isCapturing && (
                    <div
                        onClick={handleClick}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            cursor: 'crosshair',
                            zIndex: 10,
                        }}
                    />
                )}

                {/* Capture Overlay Label */}
                {isCapturing && (
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(239,68,68,0.9)',
                        color: '#fff',
                        padding: '5px 15px',
                        borderRadius: 20,
                        fontSize: '0.75em',
                        fontWeight: 600,
                        pointerEvents: 'none',
                        zIndex: 20,
                    }}>
                        🔴 ĐANG CAPTURE - {
                            captureMode === 'tap' ? 'Click để tạo node Chạm' :
                                captureMode === 'swipe' ? 'Kéo để tạo node Vuốt' :
                                    captureMode === 'color' ? (isFetchingColor ? '⌛ Đang lấy màu...' : 'Chọn điểm để lấy màu') :
                                        'Click để lấy Tọa độ'
                        }
                    </div>
                )}
            </div>

            {/* Current Device Info */}
            {selectedDevice && (
                <div style={{
                    padding: '10px 15px',
                    borderTop: '1px solid #333',
                    fontSize: '0.75em',
                    color: '#888',
                    textAlign: 'center',
                }}>
                    {selectedDevice.name} • {selectedDevice.ip} • 📱 {screenSize.width}x{screenSize.height}
                </div>
            )}
        </div>
    );
}

export default InteractivePhone;
