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

Ví dụ:
- Tap vào nút: {"thinking": "Thấy nút Login", "action": "tap", "params": {"x": 200, "y": 500}, "message": "Tap vào nút Login"}
- Vuốt lên: {"thinking": "Cần scroll xuống", "action": "swipe", "params": {"direction": "up"}, "message": "Vuốt lên để xem thêm"}
- Nhập text: {"thinking": "Ô input đang focus", "action": "type", "params": {"text": "hello"}, "message": "Nhập text"}
- Đợi: {"thinking": "Đang loading", "action": "wait", "params": {"duration": 2000}, "message": "Đợi load xong"}
- Hoàn thành: {"thinking": "Đã xong task", "action": "done", "params": {}, "message": "Hoàn thành!"}
- Lỗi: {"thinking": "Không thể tiếp tục", "action": "error", "params": {}, "message": "Lý do lỗi"}

Lưu ý:
- Tọa độ dựa trên kích thước thực của màn hình iPhone
- Luôn ưu tiên tap vào CENTER của element, không tap vào edge
- Nếu không chắc chắn, dùng action "wait" để đợi UI ổn định`;

// IPC Handler for Grok Vision API calls
ipcMain.handle('call-grok-vision', async (event, { screenshotBase64, userPrompt, conversationHistory = [], imageFormat = 'jpeg' }) => {
    try {
        if (!XAI_API_KEY) {
            return { success: false, error: 'XAI_API_KEY not configured' };
        }

        // Determine MIME type
        const mimeType = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
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

        console.log(`🤖 Calling Grok Vision API...`);

        const response = await fetch(XAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${XAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'grok-2-vision-latest',
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

// IPC Handler to capture screenshot from device
ipcMain.handle('capture-device-screenshot', async (event, { deviceIp }) => {
    try {
        // Try multiple ports and endpoint combinations
        const portsToTry = [8080, 8081, 80];
        const endpointsToTry = [
            '/screenshot',
            '/screen',
            '/control/screenshot',
            '/control/screenshot?format=png',
            '/control/screenshot?format=jpg',
            '/control/capture',
            '/screen/capture',
            '/api/screenshot',
        ];

        let response = null;
        let screenshotUrl = '';

        // Try each port and endpoint combination
        outerLoop:
        for (const port of portsToTry) {
            for (const endpoint of endpointsToTry) {
                const url = `http://${deviceIp}:${port}${endpoint}`;
                console.log(`📸 Trying: ${url}`);
                try {
                    const resp = await fetch(url, { timeout: 3000 });
                    if (resp.ok) {
                        // Check if it's actually image data
                        const contentType = resp.headers.get('content-type') || '';
                        if (contentType.includes('image') || contentType.includes('octet')) {
                            response = resp;
                            screenshotUrl = url;
                            console.log(`📸 Success with URL: ${url} (${contentType})`);
                            break outerLoop;
                        } else {
                            console.log(`📸 Got 200 but not image: ${contentType}`);
                        }
                    }
                } catch (e) {
                    // Silently continue to next URL
                }
            }
        }

        if (!response) {
            throw new Error(`Screenshot capture failed. AutoTouch API may not support screenshot endpoint. Device: ${deviceIp}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`📸 Response content-type: ${contentType}`);

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

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
