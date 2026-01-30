// ===== Node Tooltips - Hướng dẫn sử dụng chi tiết =====

export const nodeTooltips = {
    // ========== ĐIỀU KHIỂN LUỒNG ==========
    startNode: {
        title: '▶️ Bắt đầu',
        description: 'Điểm khởi đầu của kịch bản. Mọi script đều bắt đầu từ đây.',
        howToUse: 'Kéo node này ra canvas đầu tiên, sau đó nối các node khác từ đây.',
        example: 'Start → Mở app → Tìm hình → Nếu tìm thấy → Chạm',
    },

    ifNode: {
        title: '❓ Nếu (If)',
        description: 'Kiểm tra điều kiện. Nếu đúng, chạy các node phía dưới.',
        howToUse: 'Nhập điều kiện vào ô "Condition". Ví dụ: result ~= nil (khác nil nghĩa là tìm thấy)',
        example: '📌 Tìm hình → lưu vào "result"\n📌 If: result ~= nil\n📌 Nếu đúng → Chạm vào vị trí result',
        tips: 'Dùng "~= nil" để kiểm tra tìm thấy, "== nil" để kiểm tra không tìm thấy',
    },

    ifElseNode: {
        title: '🔀 Nếu/Ngược lại (If/Else)',
        description: 'Rẽ nhánh: Nếu điều kiện đúng → đi trái (✅), sai → đi phải (❌)',
        howToUse: '• Nối ✅ Đúng (trái) cho trường hợp điều kiện đúng\n• Nối ❌ Sai (phải) cho trường hợp điều kiện sai',
        example: '📌 Tìm nút "Đăng nhập" → lưu vào "btn"\n📌 If/Else: btn ~= nil\n   ✅ Đúng → Chạm vào btn\n   ❌ Sai → Chờ 2 giây rồi thử lại',
    },

    whileNode: {
        title: '🔁 Vòng lặp While',
        description: 'Lặp lại khi điều kiện còn đúng. Dùng để đợi hoặc retry.',
        howToUse: '• Điều kiện: nhập điều kiện để tiếp tục lặp\n• Lặp tối đa: giới hạn số lần (tránh loop vô hạn)\n• 🔄 Thân vòng lặp: code bên trong loop\n• ➡️ Tiếp theo: code sau khi thoát loop',
        example: '📌 While: result == nil (lặp khi chưa tìm thấy)\n   🔄 Thân: Tìm hình → lưu result → Chờ 1 giây\n   ➡️ Tiếp: Chạm vào result (sau khi tìm thấy)',
    },

    forNode: {
        title: '🔢 Vòng lặp For',
        description: 'Lặp từ số A đến số B. Dùng khi biết trước số lần lặp.',
        howToUse: '• Biến: tên biến đếm (i)\n• Bắt đầu: giá trị đầu (1)\n• Kết thúc: giá trị cuối (10)\n• Bước: tăng mỗi lần (1)',
        example: '📌 For i = 1 đến 5:\n   🔄 Thân: Chạm vào nút "Like"\n   → Sẽ chạm 5 lần!',
    },

    forEachNode: {
        title: '📃 Duyệt mảng (ForEach)',
        description: 'Duyệt qua từng phần tử trong mảng/bảng kết quả.',
        howToUse: 'Khi findColor/findColors trả về nhiều kết quả, dùng ForEach để xử lý từng cái.',
        example: '📌 Tìm tất cả nút đỏ → lưu "buttons"\n📌 ForEach k, v in buttons:\n   🔄 Thân: Chạm vào v.x, v.y\n   → Sẽ chạm vào TẤT CẢ nút tìm được!',
    },

    breakNode: {
        title: '🛑 Thoát vòng lặp (Break)',
        description: 'Thoát khỏi vòng lặp hiện tại ngay lập tức.',
        howToUse: 'Đặt trong vòng lặp, khi muốn dừng sớm.',
        example: '📌 While tìm kiếm:\n   📌 If tìm thấy: Break → thoát loop',
    },

    stopNode: {
        title: '⏹️ Dừng kịch bản (Stop)',
        description: 'Kết thúc toàn bộ kịch bản ngay lập tức.',
        howToUse: 'Dùng khi muốn dừng hẳn script, không chạy tiếp.',
        example: '📌 Nếu gặp lỗi → Stop (dừng hẳn)',
    },

    // ========== MÀU SẮC & HÌNH ẢNH ==========
    findColorNode: {
        title: '🔍 Tìm màu (findColor)',
        description: 'Tìm vị trí của một màu trên màn hình và lưu vào biến.',
        howToUse: '1. Nhập mã màu HEX (ví dụ: 0xFF0000 = đỏ)\n2. Số kết quả: bao nhiêu điểm muốn tìm\n3. Vùng tìm: giới hạn khu vực (tùy chọn)\n4. Lưu vào biến: tên biến để dùng sau',
        example: '📌 Tìm màu 0xFF0000 → lưu "pos"\n📌 If: pos ~= nil (tìm thấy)\n   📌 Chạm vào pos[1], pos[2]',
        tips: 'Kết quả trả về: {x, y} hoặc nil nếu không tìm thấy',
    },

    findColorsNode: {
        title: '🔎 Tìm nhiều màu (findColors)',
        description: 'Tìm vị trí dựa trên pattern nhiều màu (chống nhầm lẫn).',
        howToUse: 'Dùng khi một màu không đủ chính xác - cần nhiều màu để xác định.',
        example: '📌 Tìm pattern: màu chính + offset\n📌 Chính xác hơn findColor đơn lẻ',
    },

    findImageNode: {
        title: '🖼️ Tìm hình (findImage)',
        description: 'Tìm một hình ảnh nhỏ trên màn hình.',
        howToUse: '1. Đường dẫn: file hình cần tìm (.png)\n2. Ngưỡng: độ khớp (0.9 = 90%)\n3. Lưu vào biến: vị trí tìm được',
        example: '📌 Tìm "btn_login.png" → lưu "loginBtn"\n📌 If: loginBtn ~= nil\n   📌 Chạm vào loginBtn.x, loginBtn.y',
        tips: 'Chụp ảnh nút/icon cần tìm rồi lưu vào thư mục script',
    },

    getColorNode: {
        title: '🎨 Lấy màu (getColor)',
        description: 'Lấy mã màu tại một điểm cụ thể trên màn hình.',
        howToUse: 'Nhập tọa độ X, Y. Dùng để debug hoặc kiểm tra trạng thái.',
        example: '📌 Lấy màu tại (100, 200) → lưu "color"\n📌 If: color == 0x00FF00 (màu xanh)\n   📌 Nghĩa là đang ở trạng thái OK',
    },

    screenshotNode: {
        title: '📸 Chụp màn hình (Screenshot)',
        description: 'Chụp và lưu ảnh màn hình.',
        howToUse: 'Nhập đường dẫn file để lưu. Có thể chụp một vùng cụ thể.',
        example: '📌 screenshot("result.png")\n📌 Dùng để debug hoặc lưu bằng chứng',
    },

    // ========== CHẠM MÀN HÌNH ==========
    tapNode: {
        title: '👆 Chạm (Tap)',
        description: 'Chạm vào một điểm trên màn hình.',
        howToUse: '• Nhập X, Y cố định\n• HOẶC dùng biến từ findColor/findImage',
        example: '📌 Cách 1: Tap X=100, Y=200 (cố định)\n📌 Cách 2: Tap X=result.x, Y=result.y (từ tìm kiếm)',
        tips: 'Dùng biến để tap động vào vị trí tìm được!',
    },

    swipeNode: {
        title: '↔️ Vuốt (Swipe)',
        description: 'Vuốt từ điểm A đến điểm B.',
        howToUse: 'Nhập tọa độ bắt đầu (X1, Y1) và kết thúc (X2, Y2).',
        example: '📌 Vuốt từ (500, 800) đến (500, 200)\n📌 = Vuốt lên để scroll',
    },

    longPressNode: {
        title: '✋ Nhấn giữ (Long Press)',
        description: 'Giữ ngón tay tại một điểm trong thời gian dài.',
        howToUse: 'Nhập X, Y và thời gian giữ (milliseconds).',
        example: '📌 Long press 2000ms tại nút để mở menu',
    },

    // ========== CHỜ ĐỢI ==========
    waitNode: {
        title: '⏸️ Tạm dừng (Wait)',
        description: 'Chờ một khoảng thời gian rồi mới chạy tiếp.',
        howToUse: 'Nhập thời gian bằng mili giây (ms). 1000ms = 1 giây.',
        example: '📌 Wait 2000ms = Chờ 2 giây\n📌 Dùng giữa các thao tác để đợi app load',
    },

    waitForColorNode: {
        title: '🎨 Chờ màu xuất hiện',
        description: 'Chờ đến khi một màu xuất hiện trên màn hình.',
        howToUse: 'Nhập màu cần chờ và timeout. Script sẽ dừng chờ đến khi thấy màu.',
        example: '📌 Chờ màu xanh (loading xong)\n📌 Khi thấy → tiếp tục script',
    },

    waitForImageNode: {
        title: '🖼️ Chờ hình xuất hiện',
        description: 'Chờ đến khi một hình ảnh xuất hiện trên màn hình.',
        howToUse: 'Nhập path ảnh cần chờ. Script sẽ dừng cho đến khi thấy ảnh.',
        example: '📌 Chờ "dialog_success.png" xuất hiện\n📌 Khi thấy → Chạm OK',
    },

    // ========== ỨNG DỤNG ==========
    appRunNode: {
        title: '▶️ Mở ứng dụng (appRun)',
        description: 'Mở một ứng dụng bằng Bundle ID.',
        howToUse: 'Nhập Bundle ID của app. Ví dụ: com.facebook.Facebook',
        example: '📌 appRun("com.apple.mobilesafari")\n📌 = Mở Safari',
    },

    appKillNode: {
        title: '⏹️ Đóng ứng dụng (appKill)',
        description: 'Đóng/tắt một ứng dụng đang chạy.',
        howToUse: 'Nhập Bundle ID của app cần đóng.',
        example: '📌 appKill("com.facebook.Facebook")\n📌 = Đóng Facebook',
    },

    // ========== OCR ==========
    ocrNode: {
        title: '📖 Nhận dạng chữ (OCR)',
        description: 'Đọc văn bản từ màn hình và lưu vào biến.',
        howToUse: '1. Chọn phương thức (iOS Vision tốt hơn)\n2. Giới hạn vùng cần đọc (tùy chọn)\n3. Lưu kết quả vào biến',
        example: '📌 OCR vùng {100, 100, 200, 50} → lưu "text"\n📌 If: text chứa "Error"\n   📌 Thử lại...',
    },
};

// Lấy tooltip cho một node type
export function getNodeTooltip(nodeType) {
    return nodeTooltips[nodeType] || {
        title: 'Node',
        description: 'Không có hướng dẫn cho node này.',
        howToUse: 'Kéo thả vào canvas và cấu hình.',
    };
}
