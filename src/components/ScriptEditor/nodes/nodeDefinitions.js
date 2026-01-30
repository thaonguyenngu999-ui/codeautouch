// ===== AutoTouch Node Definitions - Việt Hóa =====
// https://docs.autotouch.net/lua/#extension-functions

export const nodeCategories = [
    {
        name: 'Điều khiển luồng',
        icon: '🔀',
        nodes: [
            { type: 'startNode', name: 'Bắt đầu', icon: '▶️', desc: 'Điểm bắt đầu kịch bản' },
            { type: 'ifNode', name: 'Nếu', icon: '❓', desc: 'Rẽ nhánh có điều kiện' },
            { type: 'ifElseNode', name: 'Nếu/Ngược lại', icon: '🔀', desc: 'Rẽ nhánh với else' },
            { type: 'whileNode', name: 'Vòng lặp While', icon: '🔁', desc: 'repeat...until' },
            { type: 'forNode', name: 'Vòng lặp For', icon: '🔢', desc: 'for i=1,n' },
            { type: 'forEachNode', name: 'Vòng lặp ForEach', icon: '📃', desc: 'for k,v in pairs()' },
            { type: 'breakNode', name: 'Thoát vòng lặp', icon: '🛑', desc: 'Thoát khỏi vòng lặp' },
            { type: 'stopNode', name: 'Dừng kịch bản', icon: '⏹️', desc: 'stop() - Kết thúc' },
        ]
    },
    {
        name: 'Chạm màn hình',
        icon: '👆',
        nodes: [
            { type: 'tapNode', name: 'Chạm', icon: '👆', desc: 'touchDown + touchUp tại x,y' },
            { type: 'touchDownNode', name: 'Nhấn xuống', icon: '⬇️', desc: 'touchDown(id, x, y)' },
            { type: 'touchMoveNode', name: 'Di chuyển', icon: '👉', desc: 'touchMove(id, x, y)' },
            { type: 'touchUpNode', name: 'Nhấc lên', icon: '⬆️', desc: 'touchUp(id, x, y)' },
            { type: 'swipeNode', name: 'Vuốt', icon: '↔️', desc: 'Vuốt từ A đến B' },
            { type: 'longPressNode', name: 'Nhấn giữ', icon: '✋', desc: 'Giữ chạm trong thời gian' },
            { type: 'pinchNode', name: 'Thu phóng', icon: '🤏', desc: 'Cử chỉ hai ngón' },
        ]
    },
    {
        name: 'Phím vật lý',
        icon: '🔘',
        nodes: [
            { type: 'pressHomeNode', name: 'Phím Home', icon: '🏠', desc: 'KEY_TYPE.HOME_BUTTON' },
            { type: 'pressPowerNode', name: 'Phím Nguồn', icon: '🔌', desc: 'KEY_TYPE.POWER_BUTTON' },
            { type: 'pressVolumeUpNode', name: 'Tăng âm lượng', icon: '🔊', desc: 'VOLUME_UP_BUTTON' },
            { type: 'pressVolumeDownNode', name: 'Giảm âm lượng', icon: '🔉', desc: 'VOLUME_DOWN_BUTTON' },
            { type: 'lockScreenNode', name: 'Khóa màn hình', icon: '🔒', desc: 'Nhấn phím nguồn' },
            { type: 'unlockScreenNode', name: 'Mở khóa', icon: '🔓', desc: 'Nguồn + vuốt' },
        ]
    },
    {
        name: 'Nhập văn bản',
        icon: '⌨️',
        nodes: [
            { type: 'inputTextNode', name: 'Nhập chữ', icon: '📝', desc: 'inputText(text)' },
            { type: 'copyTextNode', name: 'Sao chép', icon: '📋', desc: 'copyText(text)' },
            { type: 'clipTextNode', name: 'Lấy clipboard', icon: '📄', desc: 'clipText()' },
        ]
    },
    {
        name: 'Màu sắc & Hình ảnh',
        icon: '🎨',
        nodes: [
            { type: 'getColorNode', name: 'Lấy màu', icon: '🎨', desc: 'getColor(x, y)' },
            { type: 'getColorsNode', name: 'Lấy nhiều màu', icon: '🌈', desc: 'getColors(locations)' },
            { type: 'findColorNode', name: 'Tìm màu', icon: '🔍', desc: 'findColor(color, count, region)' },
            { type: 'findColorsNode', name: 'Tìm nhiều màu', icon: '🔎', desc: 'findColors(colors, count, region)' },
            { type: 'findImageNode', name: 'Tìm hình', icon: '🖼️', desc: 'findImage(path, count, threshold)' },
            { type: 'screenshotNode', name: 'Chụp màn hình', icon: '📸', desc: 'screenshot(path, region)' },
        ]
    },
    {
        name: 'Điều khiển ứng dụng',
        icon: '📱',
        nodes: [
            { type: 'appRunNode', name: 'Mở ứng dụng', icon: '▶️', desc: 'appRun(bundleId)' },
            { type: 'appKillNode', name: 'Đóng ứng dụng', icon: '⏹️', desc: 'appKill(bundleId)' },
            { type: 'appStateNode', name: 'Trạng thái app', icon: '📊', desc: 'appState(bundleId)' },
            { type: 'appInfoNode', name: 'Thông tin app', icon: 'ℹ️', desc: 'appInfo(bundleId)' },
            { type: 'frontMostAppNode', name: 'App đang mở', icon: '📱', desc: 'frontMostAppId()' },
            { type: 'openUrlNode', name: 'Mở URL', icon: '🔗', desc: 'openURL(urlString)' },
        ]
    },
    {
        name: 'Chờ đợi',
        icon: '⏱️',
        nodes: [
            { type: 'waitNode', name: 'Tạm dừng', icon: '⏸️', desc: 'usleep(microseconds)' },
            { type: 'waitForColorNode', name: 'Chờ màu xuất hiện', icon: '🎨', desc: 'Chờ đến khi màu xuất hiện' },
            { type: 'waitForImageNode', name: 'Chờ hình xuất hiện', icon: '🖼️', desc: 'Chờ đến khi hình xuất hiện' },
        ]
    },
    {
        name: 'Thông tin màn hình',
        icon: '📺',
        nodes: [
            { type: 'getScreenResolutionNode', name: 'Độ phân giải', icon: '📐', desc: 'getScreenResolution()' },
            { type: 'getOrientationNode', name: 'Hướng màn hình', icon: '🔄', desc: 'getOrientation()' },
            { type: 'getSNNode', name: 'Số Serial', icon: '🔢', desc: 'getSN()' },
            { type: 'getVersionNode', name: 'Phiên bản AT', icon: '📋', desc: 'getVersion()' },
        ]
    },
    {
        name: 'Tiện ích',
        icon: '🔧',
        nodes: [
            { type: 'logNode', name: 'Ghi log', icon: '📋', desc: 'log(content)' },
            { type: 'alertNode', name: 'Thông báo', icon: '🔔', desc: 'alert(message)' },
            { type: 'toastNode', name: 'Toast', icon: '💬', desc: 'toast(message, delay)' },
            { type: 'vibrateNode', name: 'Rung', icon: '📳', desc: 'vibrate()' },
            { type: 'playAudioNode', name: 'Phát âm thanh', icon: '🔊', desc: 'playAudio(file, times)' },
            { type: 'stopAudioNode', name: 'Dừng âm thanh', icon: '🔇', desc: 'stopAudio()' },
            { type: 'setTimerNode', name: 'Đặt hẹn giờ', icon: '⏰', desc: 'setTimer(script, time, repeat)' },
            { type: 'setAutoLaunchNode', name: 'Tự động chạy', icon: '🚀', desc: 'setAutoLaunch(script, on)' },
            { type: 'keepAwakeNode', name: 'Giữ thức', icon: '☕', desc: 'keepAutoTouchAwake(on)' },
            { type: 'executeNode', name: 'Chạy lệnh', icon: '💻', desc: 'execute(command)' },
        ]
    },
    {
        name: 'Dữ liệu & Biến',
        icon: '📊',
        nodes: [
            { type: 'setVariableNode', name: 'Đặt biến', icon: '📦', desc: 'local var = value' },
            { type: 'mathNode', name: 'Phép tính', icon: '🔢', desc: 'Tính toán giá trị' },
            { type: 'intToRgbNode', name: 'Int sang RGB', icon: '🎨', desc: 'intToRgb(intColor)' },
            { type: 'rgbToIntNode', name: 'RGB sang Int', icon: '🔢', desc: 'rgbToInt(r, g, b)' },
            { type: 'commentNode', name: 'Ghi chú', icon: '💬', desc: 'Thêm chú thích' },
            { type: 'evalNode', name: 'Lua tùy chỉnh', icon: '⚡', desc: 'Chạy mã Lua tùy chỉnh' },
        ]
    },
    {
        name: 'Nhận dạng chữ (OCR)',
        icon: '🤖',
        nodes: [
            { type: 'ocrNode', name: 'Đọc chữ OCR', icon: '📖', desc: 'ocr(options) - Nhận dạng văn bản' },
        ]
    },
];

// Flatten for easy access
export const allNodeDefinitions = nodeCategories.flatMap(cat =>
    cat.nodes.map(node => ({ ...node, category: cat.name }))
);
