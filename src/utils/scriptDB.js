// Script Database - Store and manage scripts using localStorage
// Later can be upgraded to SQLite or file-based storage

const STORAGE_KEY = 'autotouch_scripts';

export const scriptDB = {
    // Get all saved scripts
    getAll() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Error loading scripts:', e);
            return [];
        }
    },

    // Get a script by ID
    getById(id) {
        const scripts = this.getAll();
        return scripts.find(s => s.id === id) || null;
    },

    // Save a new script or update existing
    save(script) {
        const scripts = this.getAll();
        const now = new Date().toISOString();

        if (script.id) {
            // Update existing
            const index = scripts.findIndex(s => s.id === script.id);
            if (index >= 0) {
                scripts[index] = {
                    ...scripts[index],
                    ...script,
                    updatedAt: now,
                };
            } else {
                scripts.push({ ...script, createdAt: now, updatedAt: now });
            }
        } else {
            // Create new
            const newScript = {
                id: 'script_' + Date.now(),
                name: script.name || 'Untitled Script',
                nodes: script.nodes || [],
                edges: script.edges || [],
                luaCode: script.luaCode || '',
                createdAt: now,
                updatedAt: now,
            };
            scripts.push(newScript);
            return newScript;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
        return script;
    },

    // Delete a script
    delete(id) {
        const scripts = this.getAll().filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
    },

    // Export script to Lua file
    exportToFile(script) {
        const blob = new Blob([script.luaCode], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (script.name || 'script') + '.lua';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Export script as JSON (for backup/share)
    exportToJSON(script) {
        const data = JSON.stringify(script, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (script.name || 'script') + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Import script from JSON
    importFromJSON(jsonString) {
        try {
            const script = JSON.parse(jsonString);
            script.id = 'script_' + Date.now(); // Generate new ID
            return this.save(script);
        } catch (e) {
            console.error('Error importing script:', e);
            return null;
        }
    },
};

// Work Log - Track script execution history
const WORKLOG_KEY = 'autotouch_worklog';

export const workLogDB = {
    getAll() {
        try {
            const data = localStorage.getItem(WORKLOG_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },

    add(entry) {
        const logs = this.getAll();
        logs.unshift({
            id: 'log_' + Date.now(),
            scriptId: entry.scriptId,
            scriptName: entry.scriptName,
            action: entry.action, // 'run', 'save', 'export', 'delete'
            status: entry.status, // 'success', 'error'
            message: entry.message || '',
            timestamp: new Date().toISOString(),
        });

        // Keep only last 100 entries
        if (logs.length > 100) {
            logs.length = 100;
        }

        localStorage.setItem(WORKLOG_KEY, JSON.stringify(logs));
        return logs[0];
    },

    clear() {
        localStorage.setItem(WORKLOG_KEY, JSON.stringify([]));
    },
};
