const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Device management
    connectDevice: (ip) => ipcRenderer.invoke('connect-device', ip),
    disconnectDevice: (ip) => ipcRenderer.invoke('disconnect-device', ip),
    getDeviceScreen: (ip) => ipcRenderer.invoke('get-device-screen', ip),

    // Script management
    saveScript: (data) => ipcRenderer.invoke('save-script', data),
    loadScript: () => ipcRenderer.invoke('load-script'),
    exportLua: (script) => ipcRenderer.invoke('export-lua', script),

    // Script file operations
    saveScriptFile: (config) => ipcRenderer.invoke('save-script-file', config),
    uploadScriptToDevice: (config) => ipcRenderer.invoke('upload-script-to-device', config),
    runScriptOnDevice: (config) => ipcRenderer.invoke('run-script-on-device', config),
    stopScriptOnDevice: (config) => ipcRenderer.invoke('stop-script-on-device', config),
    getColorOnDevice: (config) => ipcRenderer.invoke('get-color-on-device', config),

    // xAI API
    callXaiApi: (messages, systemPrompt) => ipcRenderer.invoke('call-xai-api', messages, systemPrompt),

    // Grok Vision API
    callGrokVision: (config) => ipcRenderer.invoke('call-grok-vision', config),
    captureDeviceScreenshot: (config) => ipcRenderer.invoke('capture-device-screenshot', config),

    // OmniParser API (UI element detection)
    callOmniParser: (config) => ipcRenderer.invoke('call-omniparser', config),

    // VNC API
    startVncProxy: (config) => ipcRenderer.invoke('start-vnc-proxy', config),
    stopVncProxy: (config) => ipcRenderer.invoke('stop-vnc-proxy', config),

    // App info
    platform: process.platform,
});
