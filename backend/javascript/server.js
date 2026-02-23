const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: "*",
    },
    pingTimeout: 60000, // Chờ 60 giây trước khi đóng kết nối
    pingInterval: 25000 // Gửi tín hiệu kiểm tra mỗi 25 giây
});

const publicPath = path.join(__dirname, '../../frontend/public');
app.use(express.static(publicPath));

let players = [];
let currentTurnIndex = 0;
const colors = ['Đỏ', 'Xanh Lá', 'Vàng', 'Xanh Dương'];
let gameMode = 1; 

io.on('connection', (socket) => {
    console.log('Một người chơi đã kết nối:', socket.id);
    
    if (players.length >= 4) {
        socket.emit('roomFull', 'Phòng đã đầy (Tối đa 4 người).');
        socket.disconnect();
        return;
    }

    const playerColor = colors[players.length];
    players.push({ id: socket.id, color: playerColor });

    socket.emit('init', { id: socket.id, color: playerColor });
    socket.emit('updateMode', gameMode);
    io.emit('updateTurn', players[currentTurnIndex].color);

    socket.on('changeMode', (mode) => {
        gameMode = parseInt(mode);
        io.emit('updateMode', gameMode);
    });

    socket.on('rollDice', () => {
        if (players[currentTurnIndex] && players[currentTurnIndex].id === socket.id) {
            let dice1 = Math.floor(Math.random() * 6) + 1;
            let dice2 = null;
            if (gameMode === 2) {
                dice2 = Math.floor(Math.random() * 6) + 1;
            }
            // Chỉ gửi kết quả xúc xắc, CHƯA CHUYỂN LƯỢT VỘI
            io.emit('diceResult', { 
                color: playerColor, dice1: dice1, dice2: dice2, mode: gameMode
            });
        }
    });

    // NHẬN TÍN HIỆU CHUYỂN LƯỢT TỪ NGƯỜI CHƠI (khi họ đã đi xong hoặc bị kẹt)
    socket.on('endTurn', () => {
        if (players[currentTurnIndex] && players[currentTurnIndex].id === socket.id) {
            currentTurnIndex = (currentTurnIndex + 1) % players.length;
            io.emit('updateTurn', players[currentTurnIndex].color);
        }
    });

    socket.on('movePiece', (data) => {
        io.emit('updateBoard', data);
    });

    socket.on('disconnect', () => {
        console.log('Người chơi ngắt kết nối:', socket.id);
        players = players.filter(p => p.id !== socket.id);
        if (currentTurnIndex >= players.length) currentTurnIndex = 0;
        if (players.length > 0) {
            io.emit('updateTurn', players[currentTurnIndex].color);
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server game đang chạy tại http://localhost:${PORT}`);
});