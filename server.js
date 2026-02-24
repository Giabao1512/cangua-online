const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Cấu hình Socket.io tối ưu cho Vercel Serverless
const io = new Server(server, {
    cors: {
        origin: "*",
    },
    pingTimeout: 60000, // Chờ 60 giây trước khi đóng kết nối
    pingInterval: 25000 // Gửi tín hiệu kiểm tra mỗi 25 giây
});

// Trỏ thư mục chứa các file giao diện (HTML, CSS, JS) - CHỐNG LỖI 404
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// --- DỮ LIỆU TRÒ CHƠI ---
let players = [];
let currentTurnIndex = 0;
const colors = ['Đỏ', 'Xanh Lá', 'Vàng', 'Xanh Dương'];
let gameMode = 1; 
let disconnectTimers = {}; // Quản lý thời gian chờ rớt mạng

io.on('connection', (socket) => {
    // 1. NHẬN DIỆN NGƯỜI CHƠI QUA THẺ CĂN CƯỚC (CHỐNG LỖI VERCEL NGẮT KẾT NỐI)
    const playerId = socket.handshake.query.playerId;
    console.log(`Kết nối mới: SocketID [${socket.id}] | PlayerID [${playerId}]`);
    
    // Kiểm tra xem người này đã từng ở trong phòng chưa
    let existingPlayer = players.find(p => p.playerId === playerId);

    if (existingPlayer) {
        // Cập nhật lại Socket ID mới cho họ
        existingPlayer.id = socket.id;
        console.log(`[Re-connect] Trả lại phe ${existingPlayer.color} cho PlayerID: ${playerId}`);
        
        // Hủy bộ đếm giờ kick (nếu có) vì họ đã quay lại kịp
        if (disconnectTimers[playerId]) {
            clearTimeout(disconnectTimers[playerId]);
            delete disconnectTimers[playerId];
            console.log(`Đã hủy lệnh kick phe ${existingPlayer.color}`);
        }

        // Gửi lại dữ liệu cũ cho họ
        socket.emit('init', { id: socket.id, color: existingPlayer.color });
        socket.emit('updateMode', gameMode);
        
        if (players.length > 0) {
            socket.emit('updateTurn', players[currentTurnIndex].color);
        }
    } else {
        // 2. NẾU LÀ NGƯỜI CHƠI MỚI HOÀN TOÀN
        if (players.length >= 4) {
            socket.emit('roomFull', 'Phòng đã đầy (Tối đa 4 người).');
            socket.disconnect();
            return;
        }

        // TÌM MÀU CÒN TRỐNG
        const playerColor = colors.find(color => !players.some(p => p.color === color));
        
        // Lưu người chơi mới vào mảng
        players.push({ id: socket.id, playerId: playerId, color: playerColor });
        console.log(`[Người mới] Đã cấp phe ${playerColor}`);

        socket.emit('init', { id: socket.id, color: playerColor });
        socket.emit('updateMode', gameMode);
        
        // Nếu là người đầu tiên vào phòng thì reset index về 0
        if (players.length === 1) {
             currentTurnIndex = 0;
        }

        // Cập nhật lượt chơi hiện tại cho tất cả
        io.emit('updateTurn', players[currentTurnIndex].color);
    }

    // --- CÁC SỰ KIỆN LOGIC GAME ---

    socket.on('changeMode', (mode) => {
        gameMode = mode;
        io.emit('updateMode', gameMode);
    });

    socket.on('rollDice', () => {
        if (players[currentTurnIndex] && players[currentTurnIndex].id === socket.id) {
            let dice1 = Math.floor(Math.random() * 6) + 1;
            let dice2 = null;
            if (gameMode == 2) {
                dice2 = Math.floor(Math.random() * 6) + 1;
            }
            
            io.emit('diceResult', { 
                color: players[currentTurnIndex].color, 
                dice1: dice1, 
                dice2: dice2, 
                mode: gameMode
            });
        }
    });

    // CHUYỂN LƯỢT THÔNG MINH (CHỈ XOAY VÒNG NHỮNG NGƯỜI ĐANG CÓ MẶT)
    socket.on('endTurn', () => {
        if (players.length > 0 && players[currentTurnIndex] && players[currentTurnIndex].id === socket.id) {
            currentTurnIndex = (currentTurnIndex + 1) % players.length;
            io.emit('updateTurn', players[currentTurnIndex].color);
        }
    });

    socket.on('movePiece', (data) => {
        io.emit('updateBoard', data);
    });

    // XỬ LÝ KHI CÓ NGƯỜI RỚT MẠNG / THOÁT GAME (Chống kẹt phòng, kẹt lượt)
    socket.on('disconnect', () => {
        let playerIndex = players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            let pId = players[playerIndex].playerId;
            let pColor = players[playerIndex].color;
            console.log(`Phe ${pColor} vừa rớt mạng. Đợi 15s...`);

            // Đặt đồng hồ đếm ngược 15 giây
            disconnectTimers[pId] = setTimeout(() => {
                let idx = players.findIndex(p => p.playerId === pId);
                if (idx !== -1) {
                    // Ghi nhớ màu của người ĐANG GIỮ LƯỢT trước khi có người bị đá
                    let activeTurnColor = players[currentTurnIndex] ? players[currentTurnIndex].color : null;
                    
                    players.splice(idx, 1); // ĐÁ NGƯỜI CHƠI RA KHỎI PHÒNG
                    console.log(`[KICK] Đã xóa phe ${pColor}. Số người còn lại: ${players.length}`);

                    if (players.length > 0) {
                        // Nếu người bị đá CHÍNH LÀ người đang giữ lượt -> Chuyển lượt cho người tiếp theo ngay lập tức
                        if (activeTurnColor === pColor) {
                            currentTurnIndex = idx % players.length;
                            io.emit('updateTurn', players[currentTurnIndex].color);
                        } else {
                            // Nếu người bị đá là người khác -> Cập nhật lại Index để không bị nhảy sai lượt
                            currentTurnIndex = players.findIndex(p => p.color === activeTurnColor);
                        }
                    } else {
                        currentTurnIndex = 0; // Phòng trống thì reset
                    }
                }
            }, 15000); // 15 giây (bạn có thể đổi thành 30000 nếu muốn cho 30 giây)
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});