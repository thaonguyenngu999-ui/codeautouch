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

// Get color from iPhone by running a small Lua script
ipcMain.handle('get-color-on-device', async (event, { deviceIp, x, y }) => {
    const apiPort = 8080;
    const tempScriptPath = '/var/mobile/Library/AutoTouch/Scripts/.get_color_temp.lua';
    const resultFilePath = '/var/mobile/Library/AutoTouch/Scripts/.color_result.txt';

    try {
        // Step 1: Create Lua script to get color and write to file
        const luaScript = `
local c = getColor(${Math.round(x)}, ${Math.round(y)})
local f = io.open("${resultFilePath}", "w")
f:write(tostring(c))
f:close()
`;

        console.log(`🎨 Getting color at (${x}, ${y}) via Lua script...`);

        // Step 2: Upload the temp script
        const createUrl = `http://${deviceIp}:${apiPort}/file/new?path=${encodeURIComponent(tempScriptPath)}`;
        await fetch(createUrl).catch(() => {});

        const updateUrl = `http://${deviceIp}:${apiPort}/file/update?path=${encodeURIComponent(tempScriptPath)}`;
        const uploadRes = await fetch(updateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `content=${encodeURIComponent(luaScript)}`,
        });
        const uploadResult = await uploadRes.json();

        if (uploadResult.status !== 'success') {
            throw new Error('Failed to upload color script');
        }

        // Step 3: Run the script
        const playUrl = `http://${deviceIp}:${apiPort}/control/start_playing?path=${encodeURIComponent(tempScriptPath)}`;
        const playRes = await fetch(playUrl);
        const playResult = await playRes.json();

        if (playResult.status !== 'success') {
            throw new Error('Failed to run color script');
        }

        // Step 4: Wait a bit for script to complete
        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 5: Read the result file
        const readUrl = `http://${deviceIp}:${apiPort}/file/read?path=${encodeURIComponent(resultFilePath)}`;
        const readRes = await fetch(readUrl);
        const colorText = await readRes.text();

        // Parse the color (it's an integer)
        const colorInt = parseInt(colorText.trim(), 10);

        if (isNaN(colorInt)) {
            throw new Error(`Invalid color value: ${colorText}`);
        }

        const hex = '0x' + (colorInt.toString(16).toUpperCase().padStart(6, '0'));
        console.log(`🎨 Got color: ${hex} (${colorInt})`);

        return { success: true, color: hex, colorInt };

    } catch (error) {
        console.error('Get color error:', error.message);
        return { success: false, error: error.message };
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
