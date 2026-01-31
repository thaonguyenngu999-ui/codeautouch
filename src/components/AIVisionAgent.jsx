import { useState, useRef, useEffect } from 'react';
import { VncScreen } from 'react-vnc';

export default function AIVisionAgent({ selectedDevice }) {
    const [vncUrl, setVncUrl] = useState(null);
    const vncContainerRef = useRef(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, capturing, thinking, executing
    const messagesEndRef = useRef(null);
    const abortRef = useRef(false);

    // Vision model selection
    const [selectedModel, setSelectedModel] = useState('openai');
    const availableModels = [
        { value: 'openai', label: 'OpenAI GPT-4o' },
        { value: 'openai-large', label: 'OpenAI Large' },
        { value: 'claude', label: 'Claude' },
        { value: 'gemini', label: 'Gemini' },
        { value: 'qwen-coder', label: 'Qwen Coder' },
    ];

    // OmniParser mode - use precise bounding boxes from UI detection (default ON)
    const [useOmniParser, setUseOmniParser] = useState(true);
    const [omniElements, setOmniElements] = useState([]);

    // Store image and device dimensions for coordinate scaling
    const [imageSize, setImageSize] = useState({ width: 750, height: 1334 });
    const [deviceSize, setDeviceSize] = useState({ width: 750, height: 1334 });

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Start VNC proxy and fetch device screen size when device is selected
    useEffect(() => {
        if (!selectedDevice?.ip || !window.electronAPI) {
            setVncUrl(null);
            return;
        }

        const startProxy = async () => {
            try {
                // Start VNC proxy
                const result = await window.electronAPI.startVncProxy({
                    deviceId: selectedDevice.id || selectedDevice.ip,
                    targetIp: selectedDevice.ip,
                    targetPort: 5900
                });

                if (result.success) {
                    setVncUrl(`ws://localhost:${result.port}`);
                    console.log('📺 VNC connected for AI Vision');
                }

                // Fetch device screen size
                const screenResult = await window.electronAPI.getDeviceScreen(selectedDevice.ip);
                if (screenResult.success) {
                    setDeviceSize({ width: screenResult.width, height: screenResult.height });
                    console.log(`📱 Device screen: ${screenResult.width}x${screenResult.height}`);
                }
            } catch (err) {
                console.warn('VNC/screen error:', err);
            }
        };

        startProxy();
    }, [selectedDevice?.ip]);

    const addMessage = (role, content, extra = {}) => {
        setMessages(prev => [...prev, { role, content, timestamp: Date.now(), ...extra }]);
    };

    const captureScreenshot = async () => {
        if (!selectedDevice?.ip) {
            throw new Error('No device selected');
        }

        setStatus('capturing');

        // Capture from VNC canvas in this component
        const vncCanvas = vncContainerRef.current?.querySelector('canvas');

        console.log(`📸 VNC canvas:`, vncCanvas ? `${vncCanvas.width}x${vncCanvas.height}` : 'not found');

        if (vncCanvas && vncCanvas.width > 100) {
            try {
                // Get image data from VNC canvas
                const dataUrl = vncCanvas.toDataURL('image/jpeg', 0.85); // JPEG for smaller size
                const base64 = dataUrl.split(',')[1];

                // Store image dimensions for coordinate scaling
                setImageSize({ width: vncCanvas.width, height: vncCanvas.height });

                console.log(`📸 Captured from VNC canvas: ${vncCanvas.width}x${vncCanvas.height}`);

                setScreenshot(dataUrl);

                // Debug: Auto-download screenshot for testing Florence-2
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = `debug_screenshot_${Date.now()}.jpg`;
                link.click(); // Auto-download enabled
                console.log('📸 Screenshot auto-downloaded for testing');

                return {
                    success: true,
                    base64,
                    width: vncCanvas.width,
                    height: vncCanvas.height,
                    format: 'jpeg'
                };
            } catch (canvasErr) {
                console.warn('VNC canvas capture failed:', canvasErr);
            }
        }

        // Fallback to API method
        console.log('📸 VNC canvas not found, using API fallback...');
        const result = await window.electronAPI.captureDeviceScreenshot({
            deviceIp: selectedDevice.ip,
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to capture screenshot');
        }

        setScreenshot(`data:image/png;base64,${result.base64}`);
        return result;
    };

    // Scale coordinates from image size to device size
    const scaleCoordinates = (x, y) => {
        const scaleX = deviceSize.width / imageSize.width;
        const scaleY = deviceSize.height / imageSize.height;

        const scaledX = Math.round(x * scaleX);
        const scaledY = Math.round(y * scaleY);

        console.log(`📍 Scale: (${x}, ${y}) → (${scaledX}, ${scaledY}) [${imageSize.width}x${imageSize.height} → ${deviceSize.width}x${deviceSize.height}]`);

        return { x: scaledX, y: scaledY };
    };

    // Get center coordinate from bounding box [x1, y1, x2, y2]
    const getBboxCenter = (bbox) => {
        if (!bbox || bbox.length < 4) return null;
        const [x1, y1, x2, y2] = bbox;
        return {
            x: Math.round((x1 + x2) / 2),
            y: Math.round((y1 + y2) / 2),
        };
    };

    // Call OmniParser to detect UI elements
    const detectElements = async (base64Image) => {
        if (!window.electronAPI?.callOmniParser) {
            console.warn('OmniParser API not available');
            return null;
        }

        try {
            const result = await window.electronAPI.callOmniParser({
                screenshotBase64: base64Image,
            });

            if (result.success) {
                console.log(`🔍 OmniParser detected ${result.elements?.length || 0} elements`);
                setOmniElements(result.elements || []);
                return result;
            } else {
                console.warn('OmniParser failed:', result.error);
                return null;
            }
        } catch (err) {
            console.error('OmniParser error:', err);
            return null;
        }
    };

    const executeAction = async (action) => {
        if (!selectedDevice?.ip) return;

        const { action: actionType, params } = action;
        const deviceIp = selectedDevice.ip;

        switch (actionType) {
            case 'tap':
                // Validate coordinates before scaling
                if (params.x === undefined || params.y === undefined || isNaN(params.x) || isNaN(params.y)) {
                    console.error('❌ Invalid tap coordinates:', params);
                    addMessage('error', `Toa do khong hop le: x=${params.x}, y=${params.y}`);
                    return;
                }

                // Scale coordinates from image to device
                const { x, y } = scaleCoordinates(params.x, params.y);

                // Double check after scaling
                if (isNaN(x) || isNaN(y)) {
                    console.error('❌ Scaled coordinates are NaN:', { x, y });
                    addMessage('error', `Loi scale toa do: x=${x}, y=${y}`);
                    return;
                }

                // Generate and run tap script
                const tapScript = `
touchDown(1, ${x}, ${y});
usleep(math.random(100000, 200000));
touchUp(1, ${x}, ${y});
`;
                await runQuickScript(deviceIp, tapScript);
                break;

            case 'swipe':
                // Generate swipe based on direction
                const swipeScripts = {
                    up: `
local startX, startY = 375, 800
local endX, endY = 375, 300
for i = 0, 10 do
    local y = startY + (endY - startY) * i / 10
    if i == 0 then touchDown(1, startX, y) else touchMove(1, startX, y) end
    usleep(20000)
end
touchUp(1, endX, endY)
`,
                    down: `
local startX, startY = 375, 300
local endX, endY = 375, 800
for i = 0, 10 do
    local y = startY + (endY - startY) * i / 10
    if i == 0 then touchDown(1, startX, y) else touchMove(1, startX, y) end
    usleep(20000)
end
touchUp(1, endX, endY)
`,
                    left: `
local startX, startY = 600, 667
local endX, endY = 150, 667
for i = 0, 10 do
    local x = startX + (endX - startX) * i / 10
    if i == 0 then touchDown(1, x, startY) else touchMove(1, x, startY) end
    usleep(20000)
end
touchUp(1, endX, endY)
`,
                    right: `
local startX, startY = 150, 667
local endX, endY = 600, 667
for i = 0, 10 do
    local x = startX + (endX - startX) * i / 10
    if i == 0 then touchDown(1, x, startY) else touchMove(1, x, startY) end
    usleep(20000)
end
touchUp(1, endX, endY)
`,
                };
                await runQuickScript(deviceIp, swipeScripts[params.direction] || swipeScripts.up);
                break;

            case 'type':
                const typeScript = `inputText("${params.text.replace(/"/g, '\\"')}")`;
                await runQuickScript(deviceIp, typeScript);
                break;

            case 'wait':
                await new Promise(resolve => setTimeout(resolve, params.duration || 2000));
                break;

            default:
                break;
        }
    };

    const runQuickScript = async (deviceIp, luaCode) => {
        // Upload and run a quick script
        const scriptName = `_ai_tap`;
        const remotePath = '/Vcuto';  // AutoTouch script folder
        const scriptPath = `${remotePath}/${scriptName}.lua`;

        console.log(`🤖 Running script on ${deviceIp}:`, luaCode.substring(0, 100));

        const uploadResult = await window.electronAPI.uploadScriptToDevice({
            deviceIp,
            scriptName,
            luaCode,
            remotePath,
        });

        if (uploadResult.success) {
            const runResult = await window.electronAPI.runScriptOnDevice({
                deviceIp,
                scriptPath,
            });
            console.log(`🤖 Script run result:`, runResult);
            // Wait a bit for execution
            await new Promise(resolve => setTimeout(resolve, 500));
        } else {
            console.error(`🤖 Upload failed:`, uploadResult.error);
        }
    };

    const runAgent = async (userPrompt) => {
        if (!selectedDevice?.ip) {
            addMessage('system', 'Vui long chon thiet bi truoc!');
            return;
        }

        setIsRunning(true);
        abortRef.current = false;
        addMessage('user', userPrompt);

        let iteration = 0;
        const maxIterations = 20;
        let currentPrompt = userPrompt;

        try {
            while (iteration < maxIterations && !abortRef.current) {
                iteration++;

                // Step 1: Capture screenshot
                addMessage('system', `[${iteration}] Dang chup man hinh...`);
                const screenshotData = await captureScreenshot();

                const screenWidth = screenshotData.width || 750;
                const screenHeight = screenshotData.height || 1334;

                // Step 2a: If OmniParser mode, detect UI elements first
                let detectedElements = [];
                let elementsPrompt = '';

                if (useOmniParser) {
                    setStatus('detecting');
                    addMessage('system', `[${iteration}] OmniParser dang detect UI elements...`);

                    const omniResult = await detectElements(screenshotData.base64);
                    if (omniResult?.elements?.length > 0) {
                        detectedElements = omniResult.elements;
                        // Build element list for LLM
                        elementsPrompt = `\n\n[DETECTED UI ELEMENTS - Chon element_id de tap chinh xac]\n`;
                        detectedElements.forEach((el, idx) => {
                            const center = getBboxCenter(el.bbox);
                            elementsPrompt += `[${idx}] "${el.text || el.type || 'element'}" - center: (${center?.x}, ${center?.y})\n`;
                        });
                        elementsPrompt += `\nNeu tap, tra ve CA element_id VA x,y (de backup). VD: {"action":"tap","params":{"element_id":5,"x":375,"y":600}}`;
                        addMessage('system', `Tim thay ${detectedElements.length} UI elements`);
                    } else {
                        addMessage('system', `OmniParser khong detect duoc elements, dung coordinate truc tiep`);
                    }
                }

                // Step 2b: Call Vision API
                setStatus('thinking');
                addMessage('system', `[${iteration}] ${selectedModel.toUpperCase()} dang phan tich...`);

                const promptWithDimensions = `${currentPrompt}

[CRITICAL - IMAGE SIZE: ${screenWidth}x${screenHeight} pixels]
- Toa do X: 0 (trai) den ${screenWidth} (phai)
- Toa do Y: 0 (tren) den ${screenHeight} (duoi)
- Uoc luong chinh xac vi tri PIXEL cua element can tap
- VD: Icon o giua man hinh: x=${Math.round(screenWidth/2)}, y=${Math.round(screenHeight/2)}
- VD: Icon o goc duoi trai dock: x=${Math.round(screenWidth*0.15)}, y=${Math.round(screenHeight*0.92)}${elementsPrompt}`;

                const response = await window.electronAPI.callGrokVision({
                    screenshotBase64: screenshotData.base64,
                    userPrompt: promptWithDimensions,
                    imageFormat: screenshotData.format || 'jpeg',
                    model: selectedModel,
                });

                if (!response.success) {
                    addMessage('error', `Loi API: ${response.error}`);
                    break;
                }

                const { parsed, content } = response;

                if (!parsed) {
                    addMessage('assistant', content);
                    addMessage('error', 'Khong parse duoc JSON tu response');
                    break;
                }

                // If OmniParser mode and LLM returned element_id, get precise coordinates
                if (useOmniParser && parsed.action === 'tap' && parsed.params?.element_id !== undefined) {
                    const elementId = parsed.params.element_id;
                    const element = detectedElements[elementId];
                    console.log(`🔍 Element[${elementId}]:`, element);

                    if (element?.bbox) {
                        const center = getBboxCenter(element.bbox);
                        // Only use OmniParser coords if they're valid numbers
                        if (center && !isNaN(center.x) && !isNaN(center.y) && center.x > 0 && center.y > 0) {
                            parsed.params.x = center.x;
                            parsed.params.y = center.y;
                            addMessage('system', `🎯 OmniParser: element[${elementId}] → (${center.x}, ${center.y})`);
                        } else {
                            console.warn(`⚠️ Invalid bbox center for element[${elementId}]:`, center, 'bbox:', element.bbox);
                            addMessage('system', `⚠️ OmniParser bbox invalid, using Grok coordinates`);
                            // Don't modify params - let Grok's coordinates be used
                        }
                    } else {
                        console.warn(`⚠️ Element[${elementId}] has no bbox:`, element);
                        addMessage('system', `⚠️ Element has no bbox, using Grok coordinates`);
                    }
                }

                // Show AI thinking
                addMessage('assistant', `${parsed.thinking}\n\n${parsed.message}`, {
                    action: parsed.action,
                    params: parsed.params,
                });

                // Step 3: Check if done or error
                if (parsed.action === 'done') {
                    addMessage('system', 'Hoan thanh task!');
                    break;
                }

                if (parsed.action === 'error') {
                    addMessage('error', parsed.message);
                    break;
                }

                // Step 4: Execute action
                setStatus('executing');
                addMessage('system', `Thuc hien: ${parsed.action}...`);

                await executeAction(parsed);

                // Wait for UI to update
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Update prompt for next iteration
                currentPrompt = `Tiep tuc task: "${userPrompt}". Vua thuc hien: ${parsed.message}. Bay gio can lam gi tiep?`;
            }

            if (iteration >= maxIterations) {
                addMessage('system', 'Da dat gioi han so lan thuc hien (20)');
            }
        } catch (error) {
            addMessage('error', `Loi: ${error.message}`);
        } finally {
            setIsRunning(false);
            setStatus('idle');
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || isRunning) return;

        runAgent(input.trim());
        setInput('');
    };

    const handleStop = () => {
        abortRef.current = true;
        setIsRunning(false);
        setStatus('idle');
        addMessage('system', 'Da dung agent');
    };

    const handleClear = () => {
        setMessages([]);
        setScreenshot(null);
    };

    return (
        <div className="ai-vision-agent">
            <div className="ai-header">
                <h3>AI Vision Agent</h3>
                <div className="ai-status-bar">
                    <span className={`status-dot ${selectedDevice ? 'online' : ''}`}></span>
                    <span>{selectedDevice?.ip || 'Chua ket noi'}</span>
                    <select
                        className="model-selector"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isRunning}
                        style={{
                            marginLeft: 10,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: '#1a1a2e',
                            color: '#fff',
                            border: '1px solid #333',
                            fontSize: '0.85em',
                            cursor: 'pointer',
                        }}
                    >
                        {availableModels.map(m => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                    </select>
                    <label
                        style={{
                            marginLeft: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.85em',
                            cursor: 'pointer',
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={useOmniParser}
                            onChange={(e) => setUseOmniParser(e.target.checked)}
                            disabled={isRunning}
                            style={{ cursor: 'pointer' }}
                        />
                        OmniParser
                    </label>
                    <span style={{ marginLeft: 10, opacity: 0.7, fontSize: '0.85em' }}>
                        IMG: {imageSize.width}x{imageSize.height} | DEV: {deviceSize.width}x{deviceSize.height}
                    </span>
                    {status !== 'idle' && (
                        <span className="status-badge">{status}</span>
                    )}
                </div>
            </div>

            <div className="ai-content" style={{ display: 'flex', gap: '15px', overflow: 'auto' }}>
                {/* VNC Viewer - Real size, scrollable */}
                <div
                    ref={vncContainerRef}
                    className="ai-vnc-panel"
                    style={{
                        minWidth: '375px',
                        maxWidth: '400px',
                        height: '700px',
                        background: '#000',
                        borderRadius: '12px',
                        overflow: 'auto',
                        flexShrink: 0
                    }}
                >
                    {vncUrl ? (
                        <VncScreen
                            url={vncUrl}
                            scaleViewport={false}
                            background="#000000"
                            style={{ width: 'auto', height: 'auto' }}
                            retryDuration={3000}
                            qualityLevel={9}
                            compressionLevel={0}
                        />
                    ) : (
                        <div style={{ color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            {selectedDevice ? 'Connecting VNC...' : 'Select a device'}
                        </div>
                    )}
                </div>

                <div className="ai-messages" style={{ flex: 1 }}>
                    {messages.length === 0 && (
                        <div className="ai-welcome">
                            <h4>Chao mung den voi AI Vision Agent!</h4>
                            <p>Nhap lenh de AI tu dong thao tac tren iPhone.</p>
                            <div className="ai-examples">
                                <strong>Vi du:</strong>
                                <ul>
                                    <li>"Mo Facebook va like bai dau tien"</li>
                                    <li>"Mo Settings va bat Wifi"</li>
                                    <li>"Chup anh man hinh va luu vao Photos"</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, idx) => (
                        <div key={idx} className={`ai-message ${msg.role}`}>
                            <div className="message-content">
                                {msg.content}
                                {msg.action && (
                                    <div className="action-badge">
                                        {msg.action} {msg.params?.x && `(${msg.params.x}, ${msg.params.y})`}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {screenshot && (
                    <div className="ai-screenshot">
                        <img src={screenshot} alt="Device Screenshot" />
                    </div>
                )}
            </div>

            <div className="ai-input-area">
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        className="ai-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Nhap lenh cho AI (vd: Mo Facebook)..."
                        disabled={isRunning}
                    />
                    {isRunning ? (
                        <button type="button" className="ai-btn stop" onClick={handleStop}>
                            Dung
                        </button>
                    ) : (
                        <button type="submit" className="ai-btn send" disabled={!input.trim()}>
                            Chay
                        </button>
                    )}
                </form>
                <button className="ai-btn clear" onClick={handleClear}>
                    Xoa
                </button>
            </div>
        </div>
    );
}
