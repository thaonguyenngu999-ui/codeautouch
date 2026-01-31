import { useState, useEffect } from 'react';
import IPList from './IPList';
import PhoneDisplay from './PhoneDisplay';

const STORAGE_KEY = 'autotouch_devices';

// Load devices from localStorage
const loadDevices = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const devices = JSON.parse(saved);
            // Set all devices to connected on load (auto-reconnect)
            return devices.map(d => ({ ...d, status: 'connected' }));
        }
    } catch (e) {
        console.warn('Failed to load devices:', e);
    }
    return []; // Empty by default
};

// Save devices to localStorage
const saveDevices = (devices) => {
    try {
        // Save without status (will auto-connect on reload)
        const toSave = devices.map(({ id, ip, name }) => ({ id, ip, name }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.warn('Failed to save devices:', e);
    }
};

function ManageIPTab({ onDeviceSelect, selectedDevice: externalSelectedDevice }) {
    const [devices, setDevices] = useState(loadDevices);
    const [selectedDevice, setSelectedDeviceInternal] = useState(externalSelectedDevice || null);

    // Sync with external selectedDevice
    const setSelectedDevice = (device) => {
        setSelectedDeviceInternal(device);
        onDeviceSelect?.(device);
    };

    // Save to localStorage whenever devices change
    useEffect(() => {
        saveDevices(devices);
    }, [devices]);

    // Auto-select first connected device on load
    useEffect(() => {
        if (!selectedDevice && devices.length > 0) {
            const connected = devices.find(d => d.status === 'connected');
            if (connected) setSelectedDevice(connected);
        }
    }, [devices, selectedDevice]);

    const addDevice = (ip, name) => {
        // Check if device already exists
        if (devices.some(d => d.ip === ip)) {
            alert(`Device ${ip} already exists!`);
            return;
        }

        const newDevice = {
            id: Date.now(),
            ip,
            name: name || `iPhone (${ip})`,
            status: 'connected', // Auto-connect on add
        };
        setDevices([...devices, newDevice]);
        setSelectedDevice(newDevice); // Auto-select the new device
    };

    const removeDevice = (id) => {
        setDevices(devices.filter(d => d.id !== id));
        if (selectedDevice?.id === id) {
            setSelectedDevice(null);
        }
    };

    const toggleConnect = (id) => {
        setDevices(devices.map(d => {
            if (d.id === id) {
                return { ...d, status: d.status === 'connected' ? 'disconnected' : 'connected' };
            }
            return d;
        }));
    };

    return (
        <div className="tab-panel">
            <IPList
                devices={devices}
                selectedDevice={selectedDevice}
                onSelect={setSelectedDevice}
                onAdd={addDevice}
                onRemove={removeDevice}
                onToggleConnect={toggleConnect}
            />
            <PhoneDisplay
                devices={devices}
                selectedDevice={selectedDevice}
                onSelect={setSelectedDevice}
            />
        </div>
    );
}

export default ManageIPTab;
