import { useState, useRef, useEffect } from 'react';

export default function AIVisionAgent({ selectedDevice }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [screenshot, setScreenshot] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, capturing, thinking, executing
    const messagesEndRef = useRef(null);
    const abortRef = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const addMessage = (role, content, extra = {}) => {
        setMessages(prev => [...prev, { role, content, timestamp: Date.now(), ...extra }]);
    };

    const captureScreenshot = async () => {
        if (!selectedDevice?.ip) {
            throw new Error('No device selected');
        }

        setStatus('capturing');
        const result = await window.electronAPI.captureDeviceScreenshot({
            deviceIp: selectedDevice.ip,
        });

        if (!result.success) {
            throw new Error(result.error || 'Failed to capture screenshot');
        }

        setScreenshot(`data:image/png;base64,${result.base64}`);
        return result;
    };

    const executeAction = async (action) => {
        if (!selectedDevice?.ip) return;

        const { action: actionType, params } = action;
        const deviceIp = selectedDevice.ip;

        switch (actionType) {
            case 'tap':
                // Generate and run tap script
                const tapScript = `
touchDown(1, ${params.x}, ${params.y});
usleep(math.random(100000, 200000));
touchUp(1, ${params.x}, ${params.y});
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
        const scriptName = `_ai_temp_${Date.now()}`;
        const uploadResult = await window.electronAPI.uploadScriptToDevice({
            deviceIp,
            scriptName,
            luaCode,
            remotePath: '/var/mobile/Library/AutoTouch/Scripts',
        });

        if (uploadResult.success) {
            await window.electronAPI.runScriptOnDevice({
                deviceIp,
                scriptPath: uploadResult.remotePath,
            });
            // Wait a bit for execution
            await new Promise(resolve => setTimeout(resolve, 500));
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

                // Step 2: Call Grok Vision
                setStatus('thinking');
                addMessage('system', `[${iteration}] Grok dang phan tich...`);

                const response = await window.electronAPI.callGrokVision({
                    screenshotBase64: screenshotData.base64,
                    userPrompt: currentPrompt,
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
                <h3>Grok Vision Agent</h3>
                <div className="ai-status-bar">
                    <span className={`status-dot ${selectedDevice ? 'online' : ''}`}></span>
                    <span>{selectedDevice?.ip || 'Chua ket noi'}</span>
                    {status !== 'idle' && (
                        <span className="status-badge">{status}</span>
                    )}
                </div>
            </div>

            <div className="ai-content">
                <div className="ai-messages">
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
