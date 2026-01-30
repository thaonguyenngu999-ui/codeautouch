
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const IP = '192.168.1.176';
const PORT = 11111;
const URL = `http://${IP}:${PORT}/`;

async function testUploadRoot() {
    console.log(`Testing upload to root ${URL}...`);

    const content = 'tap(100, 100) -- Root upload test';
    const fileName = 'root_test.lua';

    // Try empty path to put file in WebDAV root
    const path = '/';

    const form = new FormData();
    form.append('mode', 'add');
    form.append('currentpath', path);
    form.append('newfile', Buffer.from(content), {
        filename: fileName,
        contentType: 'text/plain'
    });

    try {
        const response = await fetch(URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders()
        });

        console.log(`Response status: ${response.status}`);
        const text = await response.text();
        console.log(`Response body: ${text}`);

        // List files in WebDAV root to check
        try {
            const listResponse = await fetch(URL, { method: 'PROPFIND', headers: { Depth: '1' } });
            console.log('PROPFIND status:', listResponse.status);
            // Filza return HTML for GET, maybe XML for PROPFIND
        } catch (e) {
            console.log('List failed:', e.message);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testUploadRoot();
