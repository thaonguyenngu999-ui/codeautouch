// =====================================================
// Lua Script Generator for AutoTouch
// Based on: https://docs.autotouch.net/lua/#extension-functions
// Uses graph traversal to follow actual connections
// =====================================================

// Helper: Generate tap function
function generateTapHelper() {
    return `-- Helper: Tap function
function tap(x, y)
    touchDown(0, x, y)
    usleep(16000)
    touchUp(0, x, y)
end

`;
}

// Helper: Generate swipe function
function generateSwipeHelper() {
    return `-- Helper: Swipe function
function swipe(x1, y1, x2, y2, duration)
    local steps = 20
    local delay = (duration * 1000) / steps
    touchDown(0, x1, y1)
    for i = 1, steps do
        local x = x1 + (x2 - x1) * i / steps
        local y = y1 + (y2 - y1) * i / steps
        usleep(delay)
        touchMove(0, x, y)
    end
    touchUp(0, x2, y2)
end

`;
}

// Helper: Generate key press function
function generateKeyPressHelper() {
    return `-- Helper: Key press function
function keyPress(keyType)
    keyDown(keyType)
    usleep(10000)
    keyUp(keyType)
end

`;
}

// Helper: Convert tolerance percentage to diff value
// tolerance 100% = exact match (diff=0), tolerance 90% = diff=25
function toleranceToDiff(tolerance) {
    if (tolerance === undefined || tolerance >= 100) return null;
    return Math.floor(255 * (100 - tolerance) / 100);
}

// =====================================================
// NODE CODE GENERATORS - Separated by Category
// =====================================================

// ----- TOUCH NODES -----
// context: optional object with { colorResultVar } if tap is connected from findColors
function generateTouchCode(node, data, indent, context = {}) {
    let code = '';

    // Check if tap should use coordinates from findColors result
    const useColorResult = context.colorResultVar;

    switch (node.type) {
        case 'tapNode':
            if (useColorResult) {
                // Tap at color result position (result[1][1], result[1][2])
                const varName = context.colorResultVar;
                if (data.count && data.count > 1) {
                    code += `${indent}for i = 1, ${data.count} do\n`;
                    code += `${indent}    touchDown(1, ${varName}[1][1], ${varName}[1][2]);\n`;
                    code += `${indent}    usleep(80000);\n`;
                    code += `${indent}    touchUp(1, ${varName}[1][1], ${varName}[1][2]);\n`;
                    code += `${indent}    usleep(200000);\n`;
                    code += `${indent}end\n`;
                    code += `${indent}usleep(500000);\n`;
                } else {
                    code += `${indent}touchDown(1, ${varName}[1][1], ${varName}[1][2]);\n`;
                    code += `${indent}usleep(80000);\n`;
                    code += `${indent}touchUp(1, ${varName}[1][1], ${varName}[1][2]);\n`;
                    code += `${indent}usleep(500000);\n`;
                }
            } else if (data.count && data.count > 1) {
                code += `${indent}for i = 1, ${data.count} do\n`;
                code += `${indent}    touchDown(1, ${data.x || 0}, ${data.y || 0});\n`;
                code += `${indent}    usleep(80000);\n`;
                code += `${indent}    touchUp(1, ${data.x || 0}, ${data.y || 0});\n`;
                code += `${indent}    usleep(200000);\n`;
                code += `${indent}end\n`;
                code += `${indent}usleep(500000);\n`;
            } else {
                code += `${indent}touchDown(1, ${data.x || 0}, ${data.y || 0});\n`;
                code += `${indent}usleep(80000);\n`;
                code += `${indent}touchUp(1, ${data.x || 0}, ${data.y || 0});\n`;
                code += `${indent}usleep(500000);\n`;
            }
            break;

        case 'touchDownNode':
            code += `${indent}touchDown(1, ${data.x || 0}, ${data.y || 0});\n`;
            break;

        case 'touchMoveNode':
            code += `${indent}touchMove(1, ${data.x || 0}, ${data.y || 0});\n`;
            break;

        case 'touchUpNode':
            code += `${indent}touchUp(1, ${data.x || 0}, ${data.y || 0});\n`;
            break;

        case 'swipeNode':
            let startX, startY, endX, endY;
            if (data.direction === 'custom') {
                startX = data.startX || 200;
                startY = data.startY || 400;
                endX = data.endX || 200;
                endY = data.endY || 100;
            } else {
                // Preset directions
                const presets = {
                    'up': { x1: 200, y1: 600, x2: 200, y2: 200 },
                    'down': { x1: 200, y1: 200, x2: 200, y2: 600 },
                    'left': { x1: 300, y1: 400, x2: 50, y2: 400 },
                    'right': { x1: 50, y1: 400, x2: 300, y2: 400 },
                };
                const preset = presets[data.direction || 'up'];
                startX = preset.x1; startY = preset.y1;
                endX = preset.x2; endY = preset.y2;
            }
            code += `${indent}touchDown(1, ${startX}, ${startY});\n`;
            code += `${indent}usleep(10000);\n`;
            code += `${indent}touchMove(1, ${endX}, ${endY});\n`;
            code += `${indent}usleep(${(data.duration || 300) * 1000});\n`;
            code += `${indent}touchUp(1, ${endX}, ${endY});\n`;
            break;

        case 'longPressNode':
            code += `${indent}touchDown(0, ${data.x || 0}, ${data.y || 0});\n`;
            code += `${indent}usleep(${(data.duration || 1000) * 1000});\n`;
            code += `${indent}touchUp(0, ${data.x || 0}, ${data.y || 0});\n`;
            break;

        case 'pinchNode':
            code += `${indent}-- Pinch ${data.action || 'in'} at (${data.centerX || 200}, ${data.centerY || 400})\n`;
            const cx = data.centerX || 200;
            const cy = data.centerY || 400;
            const scale = data.scale || 0.5;
            if (data.action === 'out') {
                // Pinch out (zoom in)
                code += `${indent}touchDown(0, ${cx}, ${cy});\n`;
                code += `${indent}touchDown(1, ${cx}, ${cy});\n`;
                code += `${indent}for i = 1, 10 do\n`;
                code += `${indent}    touchMove(0, ${cx} - i * ${Math.round(50 * scale)}, ${cy});\n`;
                code += `${indent}    touchMove(1, ${cx} + i * ${Math.round(50 * scale)}, ${cy});\n`;
                code += `${indent}    usleep(30000);\n`;
                code += `${indent}end\n`;
                code += `${indent}touchUp(0, ${cx - 500 * scale}, ${cy});\n`;
                code += `${indent}touchUp(1, ${cx + 500 * scale}, ${cy});\n`;
            } else {
                // Pinch in (zoom out)
                code += `${indent}touchDown(0, ${cx - 100}, ${cy});\n`;
                code += `${indent}touchDown(1, ${cx + 100}, ${cy});\n`;
                code += `${indent}for i = 1, 10 do\n`;
                code += `${indent}    touchMove(0, ${cx - 100} + i * 10, ${cy});\n`;
                code += `${indent}    touchMove(1, ${cx + 100} - i * 10, ${cy});\n`;
                code += `${indent}    usleep(30000);\n`;
                code += `${indent}end\n`;
                code += `${indent}touchUp(0, ${cx}, ${cy});\n`;
                code += `${indent}touchUp(1, ${cx}, ${cy});\n`;
            }
            break;
    }

    return code;
}

// ----- KEY NODES -----
function generateKeyCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'pressHomeNode':
            code += `${indent}keyDown(KEY_TYPE.HOME_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.HOME_BUTTON);\n`;
            break;
        case 'pressPowerNode':
            code += `${indent}keyDown(KEY_TYPE.POWER_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.POWER_BUTTON);\n`;
            break;
        case 'pressVolumeUpNode':
            code += `${indent}keyDown(KEY_TYPE.VOLUME_UP_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.VOLUME_UP_BUTTON);\n`;
            break;
        case 'pressVolumeDownNode':
            code += `${indent}keyDown(KEY_TYPE.VOLUME_Down_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.VOLUME_Down_BUTTON);\n`;
            break;
        case 'lockScreenNode':
            code += `${indent}-- Lock screen\n`;
            code += `${indent}keyDown(KEY_TYPE.POWER_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.POWER_BUTTON);\n`;
            break;
        case 'unlockScreenNode':
            code += `${indent}-- Unlock screen\n`;
            code += `${indent}keyDown(KEY_TYPE.POWER_BUTTON);\n`;
            code += `${indent}usleep(50000);\n`;
            code += `${indent}keyUp(KEY_TYPE.POWER_BUTTON);\n`;
            code += `${indent}usleep(1000000);\n`;
            code += `${indent}local w, h = getScreenResolution();\n`;
            code += `${indent}touchDown(0, 10, h/2);\n`;
            code += `${indent}touchMove(0, w - 10, h/2);\n`;
            code += `${indent}usleep(300000);\n`;
            code += `${indent}touchUp(0, w - 10, h/2);\n`;
            break;
    }

    return code;
}

// ----- TEXT INPUT NODES -----
function generateTextCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'inputTextNode':
            code += `${indent}inputText("${(data.text || '').replace(/"/g, '\\"')}");\n`;
            break;
        case 'copyTextNode':
            code += `${indent}copyText("${(data.text || '').replace(/"/g, '\\"')}");\n`;
            break;
        case 'clipTextNode':
            code += `${indent}local ${data.variable || 'clipboardText'} = clipText();\n`;
            break;
    }

    return code;
}

// ----- COLOR & IMAGE NODES -----
function generateColorCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'getColorNode':
            code += `${indent}local ${data.variable || 'color'} = getColor(${data.x || 0}, ${data.y || 0});\n`;
            break;
        case 'getColorsNode':
            code += `${indent}local ${data.variable || 'colors'} = getColors(${data.locations || '{}'});\n`;
            break;
        case 'findColorNode': {
            const colorVal = data.colorDec || data.color || 0;
            const hexComment = data.color ? `-- ${data.color}` : '';

            // Build arguments and remove trailing nils
            const args = [
                colorVal,
                data.count !== undefined ? data.count : 1,
                data.region || 'nil',
                data.debug ? 'true' : 'nil',
                data.rightToLeft ? 'true' : 'nil',
                data.bottomToTop ? 'true' : 'nil'
            ];

            // Trim trailing 'nil'
            while (args.length > 3 && args[args.length - 1] === 'nil') {
                args.pop();
            }

            code += `${indent}local ${data.variable || 'result'} = findColor(${args.join(', ')}); ${hexComment}\n`;
            break;
        }
        case 'findColorsNode': {
            // Use native findColors with diff parameter
            // Signature: findColors(colors, count, region, debug, rightToLeft, bottomToTop, diff)
            const diff = toleranceToDiff(data.tolerance);
            const args = [
                data.colors || '{}',
                data.count !== undefined ? data.count : 0,
                data.region || 'nil',
            ];

            // Add optional args if they are set or if we need diff
            if (data.debug || data.rightToLeft || data.bottomToTop || diff !== null) {
                args.push(data.debug ? 'true' : 'nil');
                args.push(data.rightToLeft ? 'true' : 'nil');
                args.push(data.bottomToTop ? 'true' : 'nil');
                if (diff !== null) {
                    args.push(diff);
                }
            }

            // Trim trailing nils (but keep diff if present)
            while (args.length > 3 && args[args.length - 1] === 'nil') {
                args.pop();
            }

            const varName = data.variable || 'result';
            code += `${indent}local ${varName} = findColors(${args.join(', ')});\n`;
            break;
        }
        case 'findImageNode': {
            const args = [
                `"${data.imagePath || ''}"`,
                data.count !== undefined ? data.count : 1,
                data.threshold || 0.9,
                data.region || 'nil',
                data.debug ? 'true' : 'nil',
                data.method || 'nil'
            ];

            while (args.length > 3 && args[args.length - 1] === 'nil') {
                args.pop();
            }

            code += `${indent}local ${data.variable || 'result'} = findImage(${args.join(', ')});\n`;
            break;
        }
        case 'screenshotNode':
            if (data.filePath) {
                const region4 = data.region || 'nil';
                code += `${indent}screenshot("${data.filePath}", ${region4});\n`;
            } else {
                code += `${indent}screenshot();\n`;
            }
            break;
        case 'coordinateNode':
            code += `${indent}local ${data.variable || 'tap'} = {${data.x || 0}, ${data.y || 0}};\n`;
            code += `${indent}alert(string.format("x: %.2f, y: %.2f", ${data.variable || 'tap'}[1], ${data.variable || 'tap'}[2]));\n`;
            break;
    }

    return code;
}

// ----- APP CONTROL NODES -----
function generateAppCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'appRunNode':
            code += `${indent}appRun("${data.bundleId || ''}");\n`;
            break;
        case 'appKillNode':
            code += `${indent}appKill("${data.bundleId || ''}");\n`;
            break;
        case 'appStateNode':
            code += `${indent}local ${data.variable || 'appState'} = appState("${data.bundleId || ''}");\n`;
            break;
        case 'appInfoNode':
            code += `${indent}local ${data.variable || 'appInfo'} = appInfo("${data.bundleId || ''}");\n`;
            break;
        case 'frontMostAppNode':
            code += `${indent}local ${data.variable || 'frontApp'} = frontMostAppId();\n`;
            break;
        case 'openUrlNode':
            code += `${indent}openURL("${data.url || ''}");\n`;
            break;
    }

    return code;
}

// ----- WAIT & TIMING NODES -----
function generateWaitCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'waitNode':
            code += `${indent}usleep(${(data.duration || 1000) * 1000})\n`;
            break;
        case 'waitForColorNode':
            code += `${indent}-- Wait for color at (${data.x || 0}, ${data.y || 0})\n`;
            code += `${indent}local waitStart = os.time()\n`;
            code += `${indent}repeat\n`;
            code += `${indent}    local currentColor = getColor(${data.x || 0}, ${data.y || 0})\n`;
            code += `${indent}    if currentColor == ${data.targetColor || '0xFFFFFF'} then break end\n`;
            code += `${indent}    usleep(50000)\n`;
            code += `${indent}until os.difftime(os.time(), waitStart) > ${(data.timeout || 5000) / 1000}\n`;
            break;
        case 'waitForImageNode':
            code += `${indent}-- Wait for image: ${data.imagePath || ''}\n`;
            code += `${indent}local waitStart = os.time()\n`;
            code += `${indent}local imageFound = {}\n`;
            code += `${indent}repeat\n`;
            code += `${indent}    imageFound = findImage("${data.imagePath || ''}", 1, 0.9, nil)\n`;
            code += `${indent}    if #imageFound > 0 then break end\n`;
            code += `${indent}    usleep(100000)\n`;
            code += `${indent}until os.difftime(os.time(), waitStart) > ${(data.timeout || 5000) / 1000}\n`;
            break;
    }

    return code;
}

// ----- SCREEN INFO NODES -----
function generateScreenCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'getScreenResolutionNode':
            code += `${indent}local ${data.widthVar || 'screenWidth'}, ${data.heightVar || 'screenHeight'} = getScreenResolution();\n`;
            break;
        case 'getOrientationNode':
            code += `${indent}local ${data.variable || 'orientation'} = getOrientation();\n`;
            break;
        case 'getSNNode':
            code += `${indent}local ${data.variable || 'deviceSN'} = getSN();\n`;
            break;
        case 'getVersionNode':
            code += `${indent}local ${data.variable || 'atVersion'} = getVersion();\n`;
            break;
    }

    return code;
}

// ----- UTILITY NODES -----
function generateUtilityCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'logNode':
            code += `${indent}log("${(data.message || '').replace(/"/g, '\\"')}");\n`;
            break;
        case 'alertNode':
            code += `${indent}alert("${(data.message || '').replace(/"/g, '\\"')}");\n`;
            break;
        case 'toastNode':
            code += `${indent}toast("${(data.message || '').replace(/"/g, '\\"')}", ${data.delay || 2});\n`;
            break;
        case 'vibrateNode':
            code += `${indent}vibrate();\n`;
            break;
        case 'playAudioNode':
            code += `${indent}playAudio("${data.audioFile || ''}", ${data.times || 1});\n`;
            break;
        case 'stopAudioNode':
            code += `${indent}stopAudio();\n`;
            break;
        case 'setTimerNode':
            // setTimer(scriptPath, fireTime, repeat, interval)
            const repeat = data.repeat ? 'true' : 'false';
            const fireTime = isNaN(data.fireTime) ? `"${data.fireTime}"` : data.fireTime;
            code += `${indent}setTimer("${data.scriptPath || ''}", ${fireTime || 0}, ${repeat}, ${data.interval || 0});\n`;
            break;
        case 'setAutoLaunchNode':
            code += `${indent}setAutoLaunch("${data.scriptPath || ''}", ${data.on ? 'true' : 'false'});\n`;
            break;
        case 'keepAwakeNode':
            code += `${indent}keepAutoTouchAwake(${data.keepAwake ? 'true' : 'false'});\n`;
            break;
        case 'executeNode':
            code += `${indent}local ${data.variable || 'result'} = execute("${(data.command || '').replace(/"/g, '\\"')}");\n`;
            break;
    }

    return code;
}

// ----- DATA & VARIABLE NODES -----
function generateDataCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'setVariableNode':
            code += `${indent}local ${data.name || 'myVar'} = ${data.value || 'nil'}\n`;
            break;
        case 'mathNode':
            code += `${indent}local ${data.variable || 'result'} = ${data.expression || '0'}\n`;
            break;
        case 'intToRgbNode':
            code += `${indent}local ${data.rVar || 'r'}, ${data.gVar || 'g'}, ${data.bVar || 'b'} = intToRgb(${data.intColor || '0'})\n`;
            break;
        case 'rgbToIntNode':
            code += `${indent}local ${data.variable || 'intColor'} = rgbToInt(${data.r || 0}, ${data.g || 0}, ${data.b || 0})\n`;
            break;
        case 'commentNode':
            const lines = (data.comment || '').split('\n');
            lines.forEach(line => {
                code += `${indent}-- ${line}\n`;
            });
            break;
        case 'evalNode':
            const codeLines = (data.code || '').split('\n');
            codeLines.forEach(line => {
                code += `${indent}${line}\n`;
            });
            break;
    }

    return code;
}

// ----- OCR NODE -----
function generateOcrCode(node, data, indent) {
    let code = '';

    code += `${indent}local ${data.variable || 'ocrResult'} = ocr({\n`;
    if (data.method === 'cloud') {
        code += `${indent}    method = OCR_METHOD.AI_CLOUD,\n`;
    } else {
        code += `${indent}    method = OCR_METHOD.IOS_VISION,\n`;
    }
    if (data.region) {
        code += `${indent}    region = ${data.region},\n`;
    }
    if (data.languages) {
        const langs = data.languages.split(',').map(l => `"${l.trim()}"`).join(', ');
        code += `${indent}    languages = {${langs}},\n`;
    }
    if (data.whitelist) {
        code += `${indent}    whitelist = "${data.whitelist}",\n`;
    }
    if (data.timeout && data.timeout !== 10) {
        code += `${indent}    timeout = ${data.timeout},\n`;
    }
    if (data.level === '1') {
        code += `${indent}    level = 1,\n`;
    }
    if (data.debug) {
        code += `${indent}    debug = true,\n`;
    }
    if (data.correct) {
        code += `${indent}    correct = true,\n`;
    }
    code += `${indent}})\n`;

    return code;
}

// ----- CONTROL FLOW NODES -----
function generateControlCode(node, data, indent) {
    let code = '';

    switch (node.type) {
        case 'startNode':
            // Không tạo code - startNode chỉ là điểm bắt đầu
            break;
        case 'stopNode':
            code += `${indent}stop()\n`;
            break;
        case 'breakNode':
            code += `${indent}break\n`;
            break;
    }

    return code;
}

// =====================================================
// MAIN GENERATOR FUNCTION
// =====================================================

export function generateLuaFromNodes(nodes, edges) {
    // Skip if only start node or no nodes
    const nonStartNodes = nodes.filter(n => n.type !== 'startNode');
    if (nonStartNodes.length === 0) {
        return '-- Kéo thả các node từ bảng bên trái để tạo kịch bản\n-- Drag nodes from left panel to create your script';
    }

    // Scan nodes to determine which helpers are needed
    const nodeTypes = new Set(nodes.map(n => n.type));
    const needsTap = nodeTypes.has('tapNode');
    const needsSwipe = nodeTypes.has('swipeNode');
    const needsKeyPress = ['pressHomeNode', 'pressPowerNode', 'pressVolumeUpNode', 'pressVolumeDownNode', 'unlockScreenNode']
        .some(t => nodeTypes.has(t));

    let script = '';
    // Helper functions (if needed)
    if (needsTap) script += generateTapHelper();
    if (needsSwipe) script += generateSwipeHelper();
    if (needsKeyPress) script += generateKeyPressHelper();
    script += '-- ============================================\n';
    script += '-- AutoTouch Script\n';
    script += '-- Generated by AutoTouch Builder\n';
    script += '-- ============================================\n\n';

    // Create node map for quick lookup
    const nodeMap = {};
    nodes.forEach(node => {
        nodeMap[node.id] = node;
    });

    // Build adjacency map from edges (source -> [targets])
    const adjacencyMap = {};
    edges.forEach(edge => {
        if (!adjacencyMap[edge.source]) {
            adjacencyMap[edge.source] = [];
        }
        adjacencyMap[edge.source].push({
            target: edge.target,
            handle: edge.sourceHandle || 'default'
        });
    });

    // Find start node
    let startNodeId = null;
    const hasIncomingEdge = new Set(edges.map(e => e.target));

    for (const node of nodes) {
        if (node.type === 'startNode') {
            startNodeId = node.id;
            break;
        }
    }

    if (!startNodeId) {
        for (const node of nodes) {
            if (!hasIncomingEdge.has(node.id)) {
                startNodeId = node.id;
                break;
            }
        }
    }

    // Track processed nodes
    const processed = new Set();
    let indentLevel = 0;

    const indent = () => '    '.repeat(indentLevel);

    // Generate code for each node type
    // context: optional object with { colorResultVar } for tap from findColors
    const generateNodeCode = (node, data, context = {}) => {
        const ind = indent();

        // Touch nodes
        if (['tapNode', 'touchDownNode', 'touchMoveNode', 'touchUpNode', 'swipeNode', 'longPressNode', 'pinchNode'].includes(node.type)) {
            return generateTouchCode(node, data, ind, context);
        }

        // Key nodes
        if (['pressHomeNode', 'pressPowerNode', 'pressVolumeUpNode', 'pressVolumeDownNode', 'lockScreenNode', 'unlockScreenNode'].includes(node.type)) {
            return generateKeyCode(node, data, ind);
        }

        // Text input nodes
        if (['inputTextNode', 'copyTextNode', 'clipTextNode'].includes(node.type)) {
            return generateTextCode(node, data, ind);
        }

        // Color & Image nodes
        if (['getColorNode', 'getColorsNode', 'findColorNode', 'findColorsNode', 'findImageNode', 'screenshotNode'].includes(node.type)) {
            return generateColorCode(node, data, ind);
        }

        // App control nodes
        if (['appRunNode', 'appKillNode', 'appStateNode', 'appInfoNode', 'frontMostAppNode', 'openUrlNode'].includes(node.type)) {
            return generateAppCode(node, data, ind);
        }

        // Wait & Timing nodes
        if (['waitNode', 'waitForColorNode', 'waitForImageNode'].includes(node.type)) {
            return generateWaitCode(node, data, ind);
        }

        // Screen info nodes
        if (['getScreenResolutionNode', 'getOrientationNode', 'getSNNode', 'getVersionNode'].includes(node.type)) {
            return generateScreenCode(node, data, ind);
        }

        // Utility nodes
        if (['logNode', 'alertNode', 'toastNode', 'vibrateNode', 'playAudioNode', 'stopAudioNode'].includes(node.type)) {
            return generateUtilityCode(node, data, ind);
        }

        // Data & Variable nodes
        if (['setVariableNode', 'mathNode', 'intToRgbNode', 'rgbToIntNode', 'commentNode', 'evalNode'].includes(node.type)) {
            return generateDataCode(node, data, ind);
        }

        // OCR node
        if (node.type === 'ocrNode') {
            return generateOcrCode(node, data, ind);
        }

        // Control flow (simple)
        if (['startNode', 'stopNode', 'breakNode'].includes(node.type)) {
            return generateControlCode(node, data, ind);
        }

        return '';
    };

    // Process node with graph traversal
    // context: optional object with { colorResultVar } when inside found branch of findColors
    const processNode = (nodeId, context = {}) => {
        if (!nodeId || processed.has(nodeId)) return '';

        const node = nodeMap[nodeId];
        if (!node) return '';

        processed.add(nodeId);

        let code = '';
        const data = node.data || {};

        // Handle control flow structures
        switch (node.type) {
            case 'ifNode':
                code += `${indent()}if ${data.condition || 'true'} then\n`;
                indentLevel++;
                // Process connected nodes
                const ifConnections = adjacencyMap[nodeId] || [];
                for (const conn of ifConnections) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}end\n`;
                return code;

            case 'ifElseNode':
                code += `${indent()}if ${data.condition || 'true'} then\n`;
                indentLevel++;
                // Then branch (default handle)
                const thenConns = (adjacencyMap[nodeId] || []).filter(c => c.handle !== 'else');
                for (const conn of thenConns) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}else\n`;
                indentLevel++;
                // Else branch
                const elseConns = (adjacencyMap[nodeId] || []).filter(c => c.handle === 'else');
                for (const conn of elseConns) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}end\n`;
                return code;

            case 'whileNode':
                const maxIter = data.maxIterations || 100;
                code += `${indent()}local __iter = 0\n`;
                code += `${indent()}while ${data.condition || 'true'} and __iter < ${maxIter} do\n`;
                code += `${indent()}    __iter = __iter + 1\n`;
                indentLevel++;
                const whileConns = adjacencyMap[nodeId] || [];
                for (const conn of whileConns) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}end\n`;
                return code;

            case 'forNode':
                const varName = data.variable || 'i';
                code += `${indent()}for ${varName} = ${data.start || 1}, ${data.end || 10}, ${data.step || 1} do\n`;
                indentLevel++;
                const forConns = adjacencyMap[nodeId] || [];
                for (const conn of forConns) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}end\n`;
                return code;

            case 'forEachNode':
                const keyVar = data.keyVar || 'k';
                const valueVar = data.valueVar || 'v';
                code += `${indent()}for ${keyVar}, ${valueVar} in pairs(${data.table || '{}'}) do\n`;
                indentLevel++;
                const foreachConns = adjacencyMap[nodeId] || [];
                for (const conn of foreachConns) {
                    code += processNode(conn.target, context);
                }
                indentLevel--;
                code += `${indent()}end\n`;
                return code;

            case 'findColorNode':
            case 'findColorsNode':
            case 'findImageNode':
                // Generate the call
                code += generateNodeCode(node, data);

                const varResult = data.variable || 'result';
                const searchConns = adjacencyMap[nodeId] || [];
                const foundConns = searchConns.filter(c => c.handle === 'found');
                const notFoundConns = searchConns.filter(c => c.handle === 'not_found');

                if (foundConns.length > 0 || notFoundConns.length > 0) {
                    // Combine robust checks for both table (findColors/findImage) and number (findColor)
                    code += `${indent()}if (${varResult} and type(${varResult}) == "table" and #${varResult} > 0) or (${varResult} and type(${varResult}) == "number" and ${varResult} > -1) then\n`;
                    indentLevel++;
                    // Pass colorResultVar context to found branch - tap nodes will use this
                    const foundContext = { colorResultVar: varResult };
                    for (const conn of foundConns) {
                        code += processNode(conn.target, foundContext);
                    }
                    indentLevel--;

                    if (notFoundConns.length > 0) {
                        code += `${indent()}else\n`;
                        indentLevel++;
                        // Not found branch - no color result context
                        for (const conn of notFoundConns) {
                            code += processNode(conn.target);
                        }
                        indentLevel--;
                    }
                    code += `${indent()}end\n`;
                } else {
                    // Segue with default handle or any connection
                    for (const conn of searchConns) {
                        code += processNode(conn.target, context);
                    }
                }
                return code;

            default:
                // Regular node - generate code and continue
                code += generateNodeCode(node, data, context);

                // Process connected nodes
                // IMPORTANT: Don't pass colorResultVar to child nodes
                // colorResultVar should only apply to the FIRST tap directly connected from findColors
                const childContext = (node.type === 'tapNode' && context.colorResultVar) ? {} : context;
                const connections = adjacencyMap[nodeId] || [];
                for (const conn of connections) {
                    code += processNode(conn.target, childContext);
                }
                return code;
        }
    };

    // Start traversal from start node
    if (startNodeId) {
        script += processNode(startNodeId);
    }

    // Add footer
    script += '\n-- Script End\n';

    return script;
}

// =====================================================
// DEFAULT NODE DATA
// =====================================================

export function getDefaultNodeData(type) {
    const defaults = {
        // Control Flow
        startNode: {},
        ifNode: { condition: 'true' },
        ifElseNode: { condition: 'true' },
        whileNode: { condition: 'true', maxIterations: 100 },
        forNode: { variable: 'i', start: 1, end: 10, step: 1 },
        forEachNode: { keyVar: 'k', valueVar: 'v', table: 'items' },
        breakNode: {},
        stopNode: {},

        // Touch
        tapNode: { x: 100, y: 200, count: 1 },
        touchDownNode: { fingerId: 0, x: 100, y: 200 },
        touchMoveNode: { fingerId: 0, x: 150, y: 250 },
        touchUpNode: { fingerId: 0, x: 150, y: 250 },
        swipeNode: { direction: 'up', duration: 300 },
        longPressNode: { x: 100, y: 200, duration: 1000 },
        pinchNode: { action: 'in', centerX: 200, centerY: 400, scale: 0.5 },

        // Physical Keys
        pressHomeNode: {},
        pressPowerNode: {},
        pressVolumeUpNode: {},
        pressVolumeDownNode: {},
        lockScreenNode: {},
        unlockScreenNode: {},

        // Text Input
        inputTextNode: { text: '' },
        copyTextNode: { text: '' },
        clipTextNode: { variable: 'clipboardText' },

        // Color & Image
        getColorNode: { x: 0, y: 0, variable: 'color' },
        getColorsNode: { locations: '{{100,200}, {300,400}}', variable: 'colors' },
        findColorNode: { color: '0xFF0000', count: 1, variable: 'result' },
        findColorsNode: { colors: '{{0xFF0000,0,0}}', count: 1, variable: 'result' },
        findImageNode: { imagePath: 'images/button.png', count: 1, threshold: 0.9, variable: 'result' },
        screenshotNode: { filePath: '', region: '' },

        // App Control
        appRunNode: { bundleId: 'com.apple.mobilesafari' },
        appKillNode: { bundleId: '' },
        appStateNode: { bundleId: '', variable: 'appState' },
        appInfoNode: { bundleId: '', variable: 'appInfo' },
        frontMostAppNode: { variable: 'frontApp' },
        openUrlNode: { url: 'https://example.com' },

        // Wait & Timing
        waitNode: { duration: 1000 },
        waitForColorNode: { x: 0, y: 0, targetColor: '0xFFFFFF', timeout: 5000 },
        waitForImageNode: { imagePath: '', timeout: 5000 },

        // Screen Info
        getScreenResolutionNode: { widthVar: 'screenWidth', heightVar: 'screenHeight' },
        getOrientationNode: { variable: 'orientation' },
        getSNNode: { variable: 'deviceSN' },
        getVersionNode: { variable: 'atVersion' },

        // Utility
        logNode: { message: '' },
        alertNode: { message: '' },
        toastNode: { message: '', delay: 2 },
        vibrateNode: {},
        playAudioNode: { audioFile: '', times: 1 },
        stopAudioNode: {},

        // Data & Variables
        setVariableNode: { name: 'myVar', value: '' },
        mathNode: { variable: 'result', expression: '' },
        intToRgbNode: { intColor: '0', rVar: 'r', gVar: 'g', bVar: 'b' },
        rgbToIntNode: { r: '255', g: '128', b: '0', variable: 'intColor' },
        commentNode: { comment: '' },
        evalNode: { code: '' },

        // OCR
        ocrNode: { method: 'vision', region: '', languages: 'en-US', variable: 'ocrResult' },
    };

    return defaults[type] || {};
}
