
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

const IP = '192.168.1.176';
const PORT = 11111;
const URL = `http://${IP}:${PORT}/`;

async function testUpload() {
    console.log(`Testing upload to ${URL}...`);

    const content = 'tap(100, 100) -- Uploaded via Node test';
    const fileName = 'node_test_' + Date.now() + '.lua';
    const path = '/var/mobile/Library/AutoTouch/Vcuto/';

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

        if (response.ok) {
            console.log('Upload seemingly successful.');

            // Verify file existence (using AutoTouch API usually port 8080)
            const verifyUrl = `http://${IP}:8080/files?path=/Vcuto`;
            try {
                const check = await fetch(verifyUrl);
                const checkJson = await check.json();
                console.log('Files in /Vcuto:', JSON.stringify(checkJson, null, 2));
            } catch (e) {
                console.log('Could not verify via AutoTouch API 8080:', e.message);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testUpload();
