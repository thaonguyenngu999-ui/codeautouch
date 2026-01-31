import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import net from 'net';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

// xAI API configuration
const XAI_API_KEY = process.env.XAI_API_KEY || '';
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

// Pollinations API configuration (supports multiple models)
const POLLINATIONS_API_KEY = process.env.POLLINATIONS_API_KEY || '';
const POLLINATIONS_API_URL = 'https://gen.pollinations.ai/v1/chat/completions';
// Available vision models: gemini, gemini-fast, claude, claude-fast, openai, openai-large, grok
const POLLINATIONS_MODEL = process.env.POLLINATIONS_MODEL || 'gemini';

// OmniParser configuration (for precise UI element detection)
// Can use Replicate API or self-hosted endpoint
const OMNIPARSER_API_URL = process.env.OMNIPARSER_API_URL || 'https://api.replicate.com/v1/predictions';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// System prompt for AI Vision Agent
const VISION_SYSTEM_PROMPT = `Bạn là AI Vision Agent điều khiển iPhone qua AutoTouch.
Nhiệm vụ: Nhìn screenshot và đưa ra action cụ thể để hoàn thành yêu cầu của user.

QUAN TRỌNG - Chỉ trả về JSON theo format:
{
  "thinking": "Phân tích ngắn gọn màn hình hiện tại",
  "action": "tap" | "swipe" | "type" | "wait" | "done" | "error",
  "params": {
    "x": number,
    "y": number,
    "text": "string (nếu action=type)",
    "direction": "up|down|left|right (nếu action=swipe)",
    "duration": number (ms, nếu action=wait)
  },
  "message": "Mô tả action đang làm"
}

CRITICAL về tọa độ:
- User sẽ cung cấp KÍCH THƯỚC CHÍNH XÁC của ảnh trong prompt
- Tọa độ x,y PHẢI nằm trong kích thước đó
- Ước lượng vị trí pixel dựa trên ảnh bạn thấy
- VD: Nếu ảnh 750x1334, icon ở góc dưới trái có thể là (100, 1200)
- VD: Nếu ảnh 300x533, icon ở góc dưới trái có thể là (40, 480)

Ví dụ:
- Tap vào nút: {"thinking": "Thấy nút Login", "action": "tap", "params": {"x": 200, "y": 500}, "message": "Tap vào nút Login"}
- Vuốt lên: {"thinking": "Cần scroll xuống", "action": "swipe", "params": {"direction": "up"}, "message": "Vuốt lên để xem thêm"}
- Nhập text: {"thinking": "Ô input đang focus", "action": "type", "params": {"text": "hello"}, "message": "Nhập text"}
- Đợi: {"thinking": "Đang loading", "action": "wait", "params": {"duration": 2000}, "message": "Đợi load xong"}
- Hoàn thành: {"thinking": "Đã xong task", "action": "done", "params": {}, "message": "Hoàn thành!"}
- Lỗi: {"thinking": "Không thể tiếp tục", "action": "error", "params": {}, "message": "Lý do lỗi"}

Lưu ý:
- Luôn ưu tiên tap vào CENTER của element, không tap vào edge
- Nếu không chắc chắn, dùng action "wait" để đợi UI ổn định`;

// IPC Handler for Vision API calls (supports Pollinations or xAI)
ipcMain.handle('call-grok-vision', async (event, { screenshotBase64, userPrompt, conversationHistory = [], imageFormat = 'jpeg', model: requestedModel }) => {
    try {
        // Prefer Pollinations API if configured, fallback to xAI
        const usePollinations = !!POLLINATIONS_API_KEY;
        const apiKey = usePollinations ? POLLINATIONS_API_KEY : XAI_API_KEY;
        const apiUrl = usePollinations ? POLLINATIONS_API_URL : XAI_API_URL;
        // Use requested model if provided, otherwise use env config or default
        const model = requestedModel || (usePollinations ? POLLINATIONS_MODEL : 'grok-2-vision-latest');

        if (!apiKey) {
            return { success: false, error: 'No API key configured (set POLLINATIONS_API_KEY or XAI_API_KEY)' };
        }

        // Determine MIME type
        const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
        console.log(`🤖 Using ${usePollinations ? 'Pollinations' : 'xAI'} API with model: ${model}`);
        console.log(`🤖 Sending image with MIME type: ${mimeType}`);

        // Build messages with image
        const messages = [
            ...conversationHistory,
            {
                role: 'user',
                content: [
                    {
                        type: 'image_url',
                        image_url: {
                            url: `data:${mimeType};base64,${screenshotBase64}`,
                        },
                    },
                    {
                        type: 'text',
                        text: userPrompt,
                    },
                ],
            },
        ];

        console.log(`🤖 Calling ${model} Vision API...`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: VISION_SYSTEM_PROMPT },
                    ...messages,
                ],
                temperature: 0.3,
                max_tokens: 1000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        console.log(`🤖 Grok response:`, content);

        // Try to parse JSON from response
        try {
            // Extract JSON from response (in case there's extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return { success: true, content, parsed };
            }
        } catch (e) {
            console.warn('Could not parse JSON from response');
        }

        return { success: true, content, parsed: null };
    } catch (error) {
        console.error('Grok Vision API Error:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for OmniParser - UI element detection with precise bounding boxes
ipcMain.handle('call-omniparser', async (event, { screenshotBase64, targetElement }) => {
    try {
        // Check if using Replicate, local Florence-2, or self-hosted OmniParser
        const isReplicate = OMNIPARSER_API_URL.includes('replicate.com');
        const isLocalFlorence = OMNIPARSER_API_URL.includes('localhost:8000') || OMNIPARSER_API_URL.includes('127.0.0.1:8000');

        if (isReplicate && !REPLICATE_API_TOKEN) {
            return { success: false, error: 'REPLICATE_API_TOKEN not configured' };
        }

        console.log(`🔍 Calling UI detection API (${isLocalFlorence ? 'Florence-2 Local' : isReplicate ? 'Replicate' : 'OmniParser'})...`);

        if (isLocalFlorence) {
            // Local Florence-2 API format (localhost:8000)
            const FormData = (await import('form-data')).default;
            const formData = new FormData();

            // Convert base64 to buffer
            const imageBuffer = Buffer.from(screenshotBase64, 'base64');
            formData.append('image_file', imageBuffer, {
                filename: 'screenshot.png',
                contentType: 'image/png',
            });
            formData.append('draw_boxes', 'true');

            const response = await fetch(`${OMNIPARSER_API_URL}/analyze`, {
                method: 'POST',
                body: formData,
                headers: formData.getHeaders(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Florence-2 API error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log(`🔍 Florence-2 found ${data.elements?.length || 0} UI elements`);

            // Convert Florence-2 format to standard format
            const elements = (data.elements || []).map((el, idx) => ({
                id: idx,
                text: el.label || el.text || `element_${idx}`,
                type: el.type || 'ui_element',
                bbox: el.bbox || el.coordinates || [el.x1, el.y1, el.x2, el.y2],
                confidence: el.confidence || el.score || 1.0,
            }));

            return {
                success: true,
                elements,
                labeledImage: data.image || data.labeled_image || null,
            };
        } else if (isReplicate) {
            // Replicate API format
            const response = await fetch(OMNIPARSER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
                },
                body: JSON.stringify({
                    version: 'fc49a0d9e7a56936c8bf20f8b3865e2c4a65c99ae1dea24adb29ec43cdab43e5', // OmniParser v2
                    input: {
                        image: `data:image/jpeg;base64,${screenshotBase64}`,
                        box_threshold: 0.3,
                        iou_threshold: 0.3,
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Replicate API error: ${response.status} - ${errorText}`);
            }

            const prediction = await response.json();

            // Replicate returns async, need to poll for result
            let result = prediction;
            while (result.status === 'starting' || result.status === 'processing') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const pollResponse = await fetch(result.urls.get, {
                    headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
                });
                result = await pollResponse.json();
            }

            if (result.status === 'succeeded') {
                // Parse OmniParser output - it returns labeled image and parsed elements
                const elements = result.output?.parsed_elements || [];
                const labeledImage = result.output?.labeled_image || null;

                console.log(`🔍 OmniParser found ${elements.length} UI elements`);

                return {
                    success: true,
                    elements,
                    labeledImage,
                    targetElement,
                };
            } else {
                throw new Error(`OmniParser failed: ${result.error || 'Unknown error'}`);
            }
        } else {
            // Self-hosted OmniParser API (e.g., Docker container on port 7860)
            const response = await fetch(`${OMNIPARSER_API_URL}/process_image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: screenshotBase64,
                    box_threshold: 0.3,
                    iou_threshold: 0.3,
                }),
            });

            if (!response.ok) {
                throw new Error(`OmniParser API error: ${response.status}`);
            }

            const data = await response.json();
            console.log(`🔍 OmniParser found ${data.elements?.length || 0} UI elements`);

            return {
                success: true,
                elements: data.elements || [],
                labeledImage: data.labeled_image || null,
                bboxes: data.bboxes || [],
            };
        }
    } catch (error) {
        console.error('UI Detection Error:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler to capture screenshot from device
ipcMain.handle('capture-device-screenshot', async (event, { deviceIp }) => {
    try {
        const apiPort = 8080;
        let response = null;

        // Quick try: Only 2 common endpoints with fast timeout
        const quickUrls = [
            `http://${deviceIp}:${apiPort}/screenshot`,
            `http://${deviceIp}:${apiPort}/control/screenshot`,
        ];

        for (const url of quickUrls) {
            try {
                console.log(`📸 Trying: ${url}`);
                const resp = await fetch(url, { signal: AbortSignal.timeout(1500) });
                if (resp.ok) {
                    const contentType = resp.headers.get('content-type') || '';
                    if (contentType.includes('image') || contentType.includes('octet')) {
                        response = resp;
                        console.log(`📸 HTTP screenshot OK!`);
                        break;
                    }
                }
            } catch (e) {
                // Continue to next
            }
        }

        // Lua script fallback
        if (!response) {
            console.log(`📸 Using Lua fallback...`);

            // screenshot("name") saves to /Vcuto/name.PNG
            const screenshotName = '_ai_temp';
            const screenshotPath = `/Vcuto/${screenshotName}.PNG`;
            const scriptPath = '/Vcuto/_ai_ss.lua';

            // Step 1: Create and upload screenshot script
            await fetch(`http://${deviceIp}:${apiPort}/file/new?path=${encodeURIComponent(scriptPath)}`).catch(() => {});
            await fetch(`http://${deviceIp}:${apiPort}/file/update?path=${encodeURIComponent(scriptPath)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `content=${encodeURIComponent(`screenshot("${screenshotName}")`)}`,
            });

            // Step 2: Run the script
            const playResp = await fetch(`http://${deviceIp}:${apiPort}/control/start_playing?path=${encodeURIComponent(scriptPath)}`);
            const playResult = await playResp.json().catch(() => ({}));
            console.log(`📸 Script result:`, playResult);

            if (playResult.status !== 'success') {
                throw new Error(`Script failed: ${playResult.info || 'unknown error'}`);
            }

            // Step 3: Wait for screenshot to be saved
            await new Promise(r => setTimeout(r, 1500));

            // Step 4: Download with retry (server may be slow with large files)
            const contentUrl = `http://${deviceIp}:${apiPort}/file/content?path=${encodeURIComponent(screenshotPath)}`;

            for (let retry = 0; retry < 3; retry++) {
                try {
                    console.log(`📸 Downloading (attempt ${retry + 1}): ${contentUrl}`);
                    const dlResp = await fetch(contentUrl);

                    if (dlResp.ok) {
                        const buffer = Buffer.from(await dlResp.arrayBuffer());
                        console.log(`📸 Downloaded ${buffer.length} bytes, first 8: ${buffer.slice(0, 8).toString('hex')}`);

                        // Check PNG (89 50 4E 47) or JPEG (FF D8 FF)
                        const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
                        const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;

                        if (isPNG || isJPEG || buffer.length > 100000) {
                            // Accept as image if valid format or large enough
                            const format = isPNG ? 'image/png' : (isJPEG ? 'image/jpeg' : 'image/png');
                            response = { ok: true, _buffer: buffer, headers: { get: () => format } };
                            console.log(`📸 Screenshot captured! Format: ${format}`);
                            break;
                        }
                    } else {
                        console.log(`📸 Download failed: ${dlResp.status}`);
                    }
                } catch (dlError) {
                    console.log(`📸 Download error (attempt ${retry + 1}): ${dlError.message}`);
                    if (retry < 2) {
                        await new Promise(r => setTimeout(r, 2000)); // Wait 2s before retry
                    }
                }
            }
        }

        if (!response) {
            throw new Error(`Screenshot failed on ${deviceIp}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`📸 Response content-type: ${contentType}`);

        // Handle both real response and fake response with _buffer
        let buffer;
        if (response._buffer) {
            buffer = response._buffer;
        } else {
            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
        }

        // Validate image data
        if (buffer.length < 100) {
            throw new Error('Screenshot data too small, likely invalid');
        }

        const base64 = buffer.toString('base64');

        // Determine format from magic bytes
        let format = 'jpeg';
        let width = 750, height = 1334;

        // Check PNG signature: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            format = 'png';
            // Get dimensions from PNG IHDR
            if (buffer.length > 24 && buffer.slice(12, 16).toString() === 'IHDR') {
                width = buffer.readUInt32BE(16);
                height = buffer.readUInt32BE(20);
            }
        }
        // Check JPEG signature: FF D8 FF
        else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            format = 'jpeg';
            // Parse JPEG for dimensions (simplified)
            // Just use defaults for now
        }
        else {
            console.warn('📸 Unknown image format, first bytes:', buffer.slice(0, 8).toString('hex'));
        }

        console.log(`📸 Screenshot captured: ${buffer.length} bytes, format: ${format}, ${width}x${height}`);

        return { success: true, base64, width, height, format };
    } catch (error) {
        console.error('Screenshot capture error:', error);
        return { success: false, error: error.message };
    }
});

// IPC Handler for xAI API calls
ipcMain.handle('call-xai-api', async (event, messages, systemPrompt) => {
    try {
        const response = await fetch(XAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${XAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'grok-3-latest',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages,
                ],
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return {
            success: true,
            content: data.choices[0].message.content,
        };
    } catch (error) {
        console.error('xAI API Error:', error);
        return {
            success: false,
            error: error.message,
        };
    }
});

// VNC Proxy Logic
const vncProxies = new Map();

ipcMain.handle('start-vnc-proxy', async (event, { deviceId, targetIp, targetPort = 5900 }) => {
    console.log(`[Proxy] Request start for ${targetIp}:${targetPort} (Device ${deviceId})`);

    try {
        // If proxy exists for this device, return existing port
        if (vncProxies.has(deviceId)) {
            const existingWss = vncProxies.get(deviceId);
            console.log(`[Proxy] Reusing existing proxy on port ${existingWss.address().port}`);
            return { success: true, port: existingWss.address().port };
        }

        // Create new WebSocket Server on random port
        const wss = new WebSocketServer({ port: 0 });

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (wss) wss.close();
                resolve({ success: false, error: 'Proxy Start Timeout' });
            }, 5000);

            wss.on('listening', () => {
                clearTimeout(timeout);
                const port = wss.address().port;
                vncProxies.set(deviceId, wss);
                console.log(`[Proxy] Started: ${targetIp}:${targetPort} <-> ws://localhost:${port}`);
                resolve({ success: true, port });
            });

            wss.on('error', (err) => {
                clearTimeout(timeout);
                console.error('[Proxy] Server Error:', err);
                resolve({ success: false, error: err.message });
            });

            wss.on('connection', (ws) => {
                console.log(`[Proxy] Client connected to proxy`);
                const tcp = net.createConnection(targetPort, targetIp);

                tcp.on('connect', () => {
                    console.log(`[Proxy] Linked to iPhone VNC (${targetIp})`);
                });

                tcp.on('error', (err) => {
                    console.warn('[Proxy] TCP Error:', err.message);
                    if (ws.readyState === ws.OPEN) ws.close(1011, err.message);
                });

                // Pipe data (binary mode)
                ws.on('message', (msg, isBinary) => {
                    if (tcp.writable) {
                        // Convert to Buffer if needed
                        const buffer = Buffer.isBuffer(msg) ? msg : Buffer.from(msg);
                        tcp.write(buffer);
                    }
                });

                tcp.on('data', (data) => {
                    if (ws.readyState === ws.OPEN) {
                        // Send as binary
                        ws.send(data, { binary: true });
                    }
                });

                // Error/Close handling
                const cleanup = () => {
                    if (!tcp.destroyed) tcp.destroy();
                    if (ws.readyState === ws.OPEN) ws.close();
                };

                ws.on('close', cleanup);
                tcp.on('close', cleanup);
                ws.on('error', (err) => {
                    console.warn('[Proxy] WS Client Error:', err.message);
                    tcp.destroy();
                });
            });
        });
    } catch (err) {
        console.error('[Proxy] Logic Error:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('stop-vnc-proxy', async (event, { deviceId }) => {
    const wss = vncProxies.get(deviceId);
    if (wss) {
        wss.close();
        vncProxies.delete(deviceId);
        console.log(`🛑 VNC Proxy stopped for device ${deviceId}`);
    }
    return { success: true };
});

// ===== Script File Operations =====
import fs from 'fs';

// Get scripts directory path
const getScriptsDir = () => {
    const scriptsDir = path.join(app.getPath('userData'), 'scripts');
    if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
    }
    return scriptsDir;
};

// Save script to local file
ipcMain.handle('save-script-file', async (event, { scriptName, luaCode }) => {
    try {
        const scriptsDir = getScriptsDir();
        const fileName = scriptName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lua';
        const filePath = path.join(scriptsDir, fileName);

        fs.writeFileSync(filePath, luaCode, 'utf8');
        console.log(`💾 Script saved: ${filePath}`);

        return { success: true, filePath };
    } catch (error) {
        console.error('Save script error:', error);
        return { success: false, error: error.message };
    }
});

// Upload script to iPhone via AutoTouch native API (POST /file/update)
ipcMain.handle('upload-script-to-device', async (event, { deviceIp, scriptName, luaCode, remotePath = '/Vcuto' }) => {
    try {
        const apiPort = 8080;
        const fileName = scriptName.replace(/[^a-zA-Z0-9_-]/g, '_') + '.lua';
        const remoteFilePath = `${remotePath}/${fileName}`;

        console.log(`📤 Updating script via AutoTouch API: http://${deviceIp}:${apiPort}/file/update?path=${remoteFilePath}`);

        // Step 0: Ensure the folder exists
        const folderUrl = `http://${deviceIp}:${apiPort}/file/newFolder?path=${encodeURIComponent(remotePath)}`;
        console.log(`📁 Ensuring folder exists: ${folderUrl}`);
        await fetch(folderUrl).catch(() => { });

        // Step 1: Ensure the file exists
        const createUrl = `http://${deviceIp}:${apiPort}/file/new?path=${encodeURIComponent(remoteFilePath)}`;
        await fetch(createUrl);

        // Step 2: Update content via POST
        const updateUrl = `http://${deviceIp}:${apiPort}/file/update?path=${encodeURIComponent(remoteFilePath)}`;

        // Use standard x-www-form-urlencoded
        const response = await fetch(updateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `content=${encodeURIComponent(luaCode)}`,
        });

        const result = await response.json();
        console.log(`📬 AutoTouch response:`, result);

        if (result.status === 'success') {
            console.log(`✅ Upload success: ${remoteFilePath}`);
            return { success: true, remotePath: remoteFilePath };
        } else {
            throw new Error(`AutoTouch update failed: ${result.info || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Upload script error:', error);
        return { success: false, error: error.message };
    }
});

// Run script on iPhone
ipcMain.handle('run-script-on-device', async (event, { deviceIp, scriptPath }) => {
    try {
        const apiPort = 8080;
        const playUrl = `http://${deviceIp}:${apiPort}/control/start_playing?path=${encodeURIComponent(scriptPath)}`;

        console.log(`▶️ Running script: ${playUrl}`);

        const response = await fetch(playUrl);
        const result = await response.json();

        if (result.status === 'success') {
            console.log(`✅ Script started on ${deviceIp}`);
            return { success: true };
        } else {
            throw new Error(result.info || 'Failed to start script');
        }
    } catch (error) {
        console.error('Run script error:', error);
        return { success: false, error: error.message };
    }
});

// Stop script on iPhone
ipcMain.handle('stop-script-on-device', async (event, { deviceIp, scriptPath }) => {
    try {
        const apiPort = 8080;
        const stopUrl = `http://${deviceIp}:${apiPort}/control/stop_playing`;
        const response = await fetch(stopUrl);
        const result = await response.json();
        return { success: result.status === 'success' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Get device screen resolution
ipcMain.handle('get-device-screen', async (event, deviceIp) => {
    try {
        const apiPort = 8080;
        const screenshotUrl = `http://${deviceIp}:${apiPort}/control/screenshot?format=png`;
        console.log(`📏 Fetching screen info from: ${screenshotUrl}`);

        const response = await fetch(screenshotUrl);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Parse PNG IHDR chunk (bytes 16-24 are Width and Height)
        // Signature: 8 bytes
        // IHDR Length: 4 bytes
        // IHDR Type: 4 bytes
        // Width: 4 bytes (offset 16)
        // Height: 4 bytes (offset 20)

        if (buffer.length > 24 && buffer.slice(12, 16).toString() === 'IHDR') {
            const width = buffer.readUInt32BE(16);
            const height = buffer.readUInt32BE(20);
            console.log(`📏 Device Resolution: ${width}x${height}`);
            return { success: true, width, height };
        }

        throw new Error('Invalid PNG data');
    } catch (error) {
        console.error('Get screen info error:', error.message);
        // Fallback to iPhone 6/7/8 resolution if failed
        return { success: true, width: 750, height: 1334, isFallback: true };
    }
});

// Get color from iPhone
ipcMain.handle('get-color-on-device', async (event, { deviceIp, x, y }) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    try {
        const apiPort = 8080;
        const colorUrl = `http://${deviceIp}:${apiPort}/control/get_color?x=${x}&y=${y}`;
        console.log(`🎨 Fetching color from: ${colorUrl}`);

        const response = await fetch(colorUrl, { signal: controller.signal });
        const result = await response.json();

        clearTimeout(timeout);

        if (result.status === 'success') {
            const colorInt = result.color;
            const hex = '0x' + (colorInt.toString(16).toUpperCase().padStart(6, '0'));
            return { success: true, color: hex, colorInt };
        }
        return { success: false, error: result.info || 'Unknown AutoTouch error' };
    } catch (error) {
        clearTimeout(timeout);
        console.error('Get color error:', error.message);
        return { success: false, error: error.name === 'AbortError' ? 'Timeout' : error.message };
    }
});

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        backgroundColor: '#0a0a0f',
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#0a0a0f',
            symbolColor: '#ffffff',
            height: 40
        },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
