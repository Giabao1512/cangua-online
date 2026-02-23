const socket = io({
    transports: ['polling', 'websocket'], // Ưu tiên polling để tránh bị ngắt kết nối đột ngột
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

const myColorEl = document.getElementById('my-color');
const statusText = document.getElementById('status-text');
const rollBtn = document.getElementById('roll-btn');
const logArea = document.getElementById('log-area');
const diceModeSelect = document.getElementById('dice-mode');
const diceResult1 = document.getElementById('dice-result-1');
const diceResult2 = document.getElementById('dice-result-2');

let myColor = '';
let currentTurn = '';
let myGameMode = 1;
let availableMoves = []; 
let gotAnotherTurn = false; // Biến kiểm tra xem có được đi tiếp không
const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

socket.on('init', (data) => {
    myColor = data.color;
    myColorEl.innerText = `Bạn là phe: ${myColor}`;
    myColorEl.style.color = getColorCode(myColor);
});

socket.on('updateMode', (mode) => {
    myGameMode = mode;
    diceModeSelect.value = mode;
    diceResult2.style.display = (mode == 1) ? 'none' : 'flex';
});

socket.on('updateTurn', (turnColor) => {
    currentTurn = turnColor;
    statusText.innerHTML = `Lượt của: <b style="color:${getColorCode(turnColor)}">${turnColor}</b>`;
    if (myColor === currentTurn) {
        rollBtn.disabled = false;
        statusText.innerHTML += "<br>(Đến lượt bạn!)";
    } else {
        rollBtn.disabled = true;
    }
});

// --- NHẬN KẾT QUẢ VÀ TỰ ĐỘNG BỎ LƯỢT NẾU KẸT ---
socket.on('diceResult', (data) => {
    diceResult1.classList.add('rolling');
    if (data.mode === 2) diceResult2.classList.add('rolling');

    let rollInterval = setInterval(() => {
        diceResult1.innerHTML = diceFaces[Math.floor(Math.random() * 6)];
        diceResult1.style.color = '#ff9a9e';
        if (data.mode === 2) {
            diceResult2.innerHTML = diceFaces[Math.floor(Math.random() * 6)];
            diceResult2.style.color = '#ff9a9e';
        }
    }, 100);

    setTimeout(() => {
        clearInterval(rollInterval);
        diceResult1.classList.remove('rolling');
        diceResult1.innerHTML = diceFaces[data.dice1 - 1];
        diceResult1.style.color = '#ff6b81'; 

        if (data.mode === 2) {
            diceResult2.classList.remove('rolling');
            diceResult2.innerHTML = diceFaces[data.dice2 - 1];
            diceResult2.style.color = '#ff6b81';
            log(`${data.color} đổ được [${data.dice1}] và [${data.dice2}]`);
        } else {
            log(`${data.color} đổ được [${data.dice1}]`);
        }

        // Nếu là lượt của mình thì nạp điểm và KIỂM TRA
        if (currentTurn === myColor) {
            if (data.mode === 1) {
                availableMoves = [data.dice1];
                gotAnotherTurn = (data.dice1 === 6);
            } else {
                availableMoves = [data.dice1, data.dice2];
                gotAnotherTurn = (data.dice1 === 6 || data.dice2 === 6 || data.dice1 === data.dice2);
            }

            // Quét xem có quân nào nhúc nhích được không
            if (!checkAnyValidMove()) {
                log('🚫 Bị chặn mọi đường! Không có nước đi hợp lệ.');
                availableMoves = []; // Xóa xúc xắc
                
                setTimeout(() => {
                    endTurnOrKeep();
                }, 1500);
            }
        }
    }, 800);
});

socket.on('roomFull', (msg) => { alert(msg); });

diceModeSelect.addEventListener('change', (e) => {
    socket.emit('changeMode', e.target.value);
});

rollBtn.addEventListener('click', () => {
    availableMoves = []; 
    gotAnotherTurn = false;
    socket.emit('rollDice');
    rollBtn.disabled = true; 
});

// Chuyển lượt hoặc cho đổ tiếp
function endTurnOrKeep() {
    if (gotAnotherTurn) {
        log('🎲 Bạn được ĐỔ TIẾP do tung được điểm đặc biệt!');
        rollBtn.disabled = false;
    } else {
        socket.emit('endTurn');
    }
}

function log(msg) {
    const p = document.createElement('div');
    p.innerText = msg;
    logArea.prepend(p);
}

function getColorCode(colorName) {
    switch(colorName) {
        case 'Đỏ': return '#ff6b81';       
        case 'Xanh Lá': return '#2ed573';  
        case 'Vàng': return '#eccc68';     
        case 'Xanh Dương': return '#70a1ff'; 
        default: return '#333';
    }
}

// =====================================
// CANVAS & VẼ BÀN CỜ 
// =====================================
const canvas = document.getElementById('gameBoard');
const ctx = canvas.getContext('2d');
const boxSize = 600 / 15;

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffcccc'; ctx.fillRect(0, 0, boxSize * 6, boxSize * 6);
    ctx.fillStyle = '#ccffcc'; ctx.fillRect(boxSize * 9, 0, boxSize * 6, boxSize * 6);
    ctx.fillStyle = '#ffffcc'; ctx.fillRect(boxSize * 9, boxSize * 9, boxSize * 6, boxSize * 6);
    ctx.fillStyle = '#ccccff'; ctx.fillRect(0, boxSize * 9, boxSize * 6, boxSize * 6);

    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;

    for (let row = 0; row < 15; row++) {
        for (let col = 0; col < 15; col++) {
            if ((row < 6 && col < 6) || (row < 6 && col > 8) || 
                (row > 8 && col < 6) || (row > 8 && col > 8)) continue; 
            
            ctx.fillStyle = '#fff'; 
            
            if ((row === 6 && col === 6) || (row === 6 && col === 8) ||
                (row === 8 && col === 6) || (row === 8 && col === 8)) ctx.fillStyle = '#eee'; 
            if (row === 7 && col === 7) ctx.fillStyle = '#333'; 

            if (col === 7 && row === 0) ctx.fillStyle = '#2ed573';  
            if (col === 14 && row === 7) ctx.fillStyle = '#eccc68'; 
            if (col === 7 && row === 14) ctx.fillStyle = '#70a1ff'; 
            if (col === 0 && row === 7) ctx.fillStyle = '#ff6b81';  

            if (col === 7 && row >= 1 && row <= 6) ctx.fillStyle = '#2ed573'; 
            if (row === 7 && col >= 8 && col <= 13) ctx.fillStyle = '#eccc68'; 
            if (col === 7 && row >= 8 && row <= 13) ctx.fillStyle = '#70a1ff'; 
            if (row === 7 && col >= 1 && col <= 6) ctx.fillStyle = '#ff6b81'; 

            if (col === 1 && row === 6) ctx.fillStyle = '#ff6b81'; 
            if (col === 8 && row === 1) ctx.fillStyle = '#2ed573'; 
            if (col === 13 && row === 8) ctx.fillStyle = '#eccc68'; 
            if (col === 6 && row === 13) ctx.fillStyle = '#70a1ff'; 

            ctx.fillRect(col * boxSize, row * boxSize, boxSize, boxSize);
            ctx.strokeRect(col * boxSize, row * boxSize, boxSize, boxSize);
            
            if (col === 7 && row >= 1 && row <= 6) drawText(row, col, row); 
            if (row === 7 && col >= 8 && col <= 13) drawText(14 - col, col, row); 
            if (col === 7 && row >= 8 && row <= 13) drawText(14 - row, col, row); 
            if (row === 7 && col >= 1 && col <= 6) drawText(col, col, row); 
        }
    }
}

function drawText(text, col, row) {
    ctx.fillStyle = '#000'; ctx.font = 'bold 16px "Baloo 2", Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, col * boxSize + boxSize / 2, row * boxSize + boxSize / 2);
}

// =====================================
// DỮ LIỆU ĐƯỜNG ĐI & QUÂN CỜ
// =====================================
const basePositions = {
    'Đỏ': [{c: 2, r: 2}, {c: 4, r: 2}, {c: 2, r: 4}, {c: 4, r: 4}],
    'Xanh Lá': [{c: 11, r: 2}, {c: 13, r: 2}, {c: 11, r: 4}, {c: 13, r: 4}],
    'Vàng': [{c: 11, r: 11}, {c: 13, r: 11}, {c: 11, r: 13}, {c: 13, r: 13}],
    'Xanh Dương': [{c: 2, r: 11}, {c: 4, r: 11}, {c: 2, r: 13}, {c: 4, r: 13}]
};

const track = [
    {c:8, r:0}, {c:8, r:1}, {c:8, r:2}, {c:8, r:3}, {c:8, r:4}, {c:8, r:5},
    {c:9, r:6}, {c:10, r:6}, {c:11, r:6}, {c:12, r:6}, {c:13, r:6}, {c:14, r:6},
    {c:14, r:7}, {c:14, r:8},
    {c:13, r:8}, {c:12, r:8}, {c:11, r:8}, {c:10, r:8}, {c:9, r:8},
    {c:8, r:9}, {c:8, r:10}, {c:8, r:11}, {c:8, r:12}, {c:8, r:13}, {c:8, r:14},
    {c:7, r:14}, {c:6, r:14},
    {c:6, r:13}, {c:6, r:12}, {c:6, r:11}, {c:6, r:10}, {c:6, r:9},
    {c:5, r:8}, {c:4, r:8}, {c:3, r:8}, {c:2, r:8}, {c:1, r:8}, {c:0, r:8},
    {c:0, r:7}, {c:0, r:6},
    {c:1, r:6}, {c:2, r:6}, {c:3, r:6}, {c:4, r:6}, {c:5, r:6},
    {c:6, r:5}, {c:6, r:4}, {c:6, r:3}, {c:6, r:2}, {c:6, r:1}, {c:6, r:0},
    {c:7, r:0}
];

const homeTracks = {
    'Đỏ': [{c: 1, r: 7}, {c: 2, r: 7}, {c: 3, r: 7}, {c: 4, r: 7}, {c: 5, r: 7}, {c: 6, r: 7}],
    'Xanh Lá': [{c: 7, r: 1}, {c: 7, r: 2}, {c: 7, r: 3}, {c: 7, r: 4}, {c: 7, r: 5}, {c: 7, r: 6}],
    'Vàng': [{c: 13, r: 7}, {c: 12, r: 7}, {c: 11, r: 7}, {c: 10, r: 7}, {c: 9, r: 7}, {c: 8, r: 7}],
    'Xanh Dương': [{c: 7, r: 13}, {c: 7, r: 12}, {c: 7, r: 11}, {c: 7, r: 10}, {c: 7, r: 9}, {c: 7, r: 8}]
};

const startIndices = { 'Đỏ': 40, 'Xanh Lá': 1, 'Vàng': 14, 'Xanh Dương': 27 };
let pieces = [];

function initPieces() {
    pieces = [];
    const playerColors = ['Đỏ', 'Xanh Lá', 'Vàng', 'Xanh Dương'];
    for (const color of playerColors) {
        for (let i = 0; i < 4; i++) {
            pieces.push({
                id: `${color}-${i}`, color: color, state: 'BASE', 
                basePos: basePositions[color][i], currentPos: null,
                trackIndex: null, stepsTaken: 0, homeIndex: null 
            });
        }
    }
}

function drawPieces() {
    const posMap = {};
    for (const p of pieces) {
        if (p.state !== 'BASE' && p.currentPos) {
            const key = `${p.currentPos.c}-${p.currentPos.r}`;
            if (!posMap[key]) posMap[key] = [];
            posMap[key].push(p);
        }
    }

    for (const piece of pieces) {
        let x, y;
        let radius = boxSize / 2.5; 

        if (piece.state === 'BASE') {
            x = piece.basePos.c * boxSize - (boxSize / 2);
            y = piece.basePos.r * boxSize - (boxSize / 2);
        } else {
            const key = `${piece.currentPos.c}-${piece.currentPos.r}`;
            const group = posMap[key];
            const index = group.indexOf(piece);
            const total = group.length;

            let centerX = piece.currentPos.c * boxSize + (boxSize / 2);
            let centerY = piece.currentPos.r * boxSize + (boxSize / 2);
            let offsetX = 0, offsetY = 0;

            if (total === 2) { radius *= 0.8; offsetX = (index === 0) ? -7 : 7; } 
            else if (total === 3) { radius *= 0.7; if (index === 0) { offsetX = -7; offsetY = 7; } if (index === 1) { offsetX = 7; offsetY = 7; } if (index === 2) { offsetX = 0; offsetY = -7; } } 
            else if (total === 4) { radius *= 0.6; if (index === 0) { offsetX = -7; offsetY = -7; } if (index === 1) { offsetX = 7; offsetY = -7; } if (index === 2) { offsetX = -7; offsetY = 7; } if (index === 3) { offsetX = 7; offsetY = 7; } }

            x = centerX + offsetX;
            y = centerY + offsetY;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2); 
        ctx.fillStyle = getColorCode(piece.color); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'; ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = '#333'; ctx.stroke(); ctx.closePath();
        
        if (piece.state === 'HOME') {
            ctx.fillStyle = '#000'; ctx.font = `bold ${radius * 1.2}px Arial`; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText("★", x, y);
        }
    }
}

// =====================================
// BỘ LỌC CHƯỚNG NGẠI VẬT & LUẬT
// =====================================
function canPieceMoveWithDie(piece, steps) {
    if (piece.state === 'BASE') {
        let canExit = false;
        if (steps === 1 || steps === 6) canExit = true;
        
        // Chế độ 2 xúc xắc: Có đổ ra 1 cặp giống nhau không?
        if (myGameMode === 2 && availableMoves.length === 2 && availableMoves[0] === availableMoves[1]) canExit = true;
        if (!canExit) return false;

        // Luật Cản: Trùng quân nhà ở ô xuất phát thì không được xuất chuồng
        const startIdx = startIndices[piece.color];
        const blocker = pieces.find(p => p.state === 'BOARD' && p.trackIndex === startIdx && p.color === piece.color);
        if (blocker) return false;

        return true;
    }
    else if (piece.state === 'BOARD') {
        if (piece.stepsTaken === 50) return true; // Cửa chuồng bay thẳng, không bị chặn
        if (piece.stepsTaken + steps > 50) return false; // Không được đi lố
        
        // 1. Kiểm tra chặn đường (Không được nhảy qua ĐẦU bất cứ ai)
        for (let i = 1; i < steps; i++) {
            let pathIdx = (piece.trackIndex + i) % 52;
            let blocker = pieces.find(p => p.state === 'BOARD' && p.trackIndex === pathIdx);
            if (blocker) return false; 
        }
        
        // 2. Kiểm tra điểm đến (Không được đè lên đầu quân cùng phe)
        let destIdx = (piece.trackIndex + steps) % 52;
        let destBlocker = pieces.find(p => p.state === 'BOARD' && p.trackIndex === destIdx && p.color === piece.color);
        if (destBlocker) return false; 
        
        return true;
    }
    else if (piece.state === 'HOME') {
        let requiredDie = piece.homeIndex + 2;
        if (steps !== requiredDie) return false; // Leo phải đúng số
        
        // Kiểm tra xem bậc trên có quân nhà chưa
        let nextIndex = piece.homeIndex + 1;
        if (nextIndex > 5) return false;
        let homeBlocker = pieces.find(p => p.state === 'HOME' && p.homeIndex === nextIndex && p.color === piece.color);
        if (homeBlocker) return false;

        return true;
    }
    return false;
}

// Quét toàn bàn xem có quân nào có thể đi được không
function checkAnyValidMove() {
    for (let p of pieces) {
        if (p.color !== myColor) continue;
        for (let die of availableMoves) {
            if (canPieceMoveWithDie(p, die)) return true;
        }
    }
    return false;
}

// Hàm Đá bay kẻ địch
function kickEnemy(targetTrackIndex) {
    let target = pieces.find(p => p.state === 'BOARD' && p.trackIndex === targetTrackIndex && p.color !== myColor);
    if (target) {
        target.state = 'BASE';
        target.currentPos = null; 
        target.trackIndex = null;
        target.stepsTaken = 0;
        target.homeIndex = null;
        socket.emit('movePiece', { 
            pieceId: target.id, newState: target.state, newPos: target.currentPos, 
            trackIndex: null, stepsTaken: 0, homeIndex: null 
        });
        log(`💥 Bạn vừa ĐÁ BAY ngựa của phe ${target.color}!`);
    }
}

// =====================================
// CLICK ĐIỀU KHIỂN
// =====================================
canvas.addEventListener('click', (e) => {
    if (currentTurn !== myColor || availableMoves.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (const piece of pieces) {
        if (piece.color !== myColor) continue;

        let px, py;
        if (piece.state === 'BASE') {
            px = piece.basePos.c * boxSize - (boxSize / 2); py = piece.basePos.r * boxSize - (boxSize / 2);
        } else {
            px = piece.currentPos.c * boxSize + (boxSize / 2); py = piece.currentPos.r * boxSize + (boxSize / 2);
        }

        if (Math.sqrt((clickX - px) ** 2 + (clickY - py) ** 2) <= boxSize / 2) {
            handlePieceClick(piece);
            break;
        }
    }
});

function handlePieceClick(piece) {
    let validDieIndex = -1;
    let chosenSteps = 0;
    
    // Tìm cục xúc xắc phù hợp để đi
    for (let i = 0; i < availableMoves.length; i++) {
        if (canPieceMoveWithDie(piece, availableMoves[i])) {
            validDieIndex = i;
            chosenSteps = availableMoves[i];
            break; 
        }
    }
    
    if (validDieIndex === -1) {
        alert('Quân cờ này đang bị cản hoặc không dùng được xúc xắc hiện tại!');
        return;
    }
    
    // TIẾN HÀNH ĐI & ĐÁ NGỰA
    let newState = piece.state, newPos = piece.currentPos;
    let newTrackIndex = piece.trackIndex, newStepsTaken = piece.stepsTaken, newHomeIndex = piece.homeIndex;
    
    if (piece.state === 'BASE') {
        newState = 'BOARD'; newTrackIndex = startIndices[piece.color];
        newPos = track[newTrackIndex]; newStepsTaken = 0;
        kickEnemy(newTrackIndex);
        log(`🐎 Đã xuất chuồng!`);
    }
    else if (piece.state === 'BOARD') {
        if (piece.stepsTaken === 50) {
            newState = 'HOME'; newHomeIndex = chosenSteps - 1;
            newPos = homeTracks[piece.color][newHomeIndex];
            log(`🚀 Bay thẳng lên bậc ${chosenSteps}!`);
        } else {
            newStepsTaken = piece.stepsTaken + chosenSteps;
            newTrackIndex = (piece.trackIndex + chosenSteps) % 52;
            newPos = track[newTrackIndex];
            kickEnemy(newTrackIndex);
            log(`🐎 Đã tiến lên ${chosenSteps} bước!`);
        }
    }
    else if (piece.state === 'HOME') {
        newHomeIndex = piece.homeIndex + 1;
        newPos = homeTracks[piece.color][newHomeIndex];
        log(`🌟 Leo an toàn lên bậc ${chosenSteps}!`);
    }
    
    // Áp dụng dữ liệu mới
    piece.state = newState; piece.currentPos = newPos;
    piece.trackIndex = newTrackIndex; piece.stepsTaken = newStepsTaken; piece.homeIndex = newHomeIndex;
    availableMoves.splice(validDieIndex, 1);
    
    socket.emit('movePiece', {
        pieceId: piece.id, newState: piece.state, newPos: piece.currentPos, 
        trackIndex: piece.trackIndex, stepsTaken: piece.stepsTaken, homeIndex: piece.homeIndex
    });
    
    drawBoard(); drawPieces();
    
    // KIỂM TRA ĐI TIẾP HAY CHUYỂN LƯỢT SAU KHI ĐI XONG
    if (availableMoves.length === 0) {
        endTurnOrKeep();
    } else {
        // Còn 1 cục xúc xắc (chế độ 2), xem có cứu vãn được không
        if (!checkAnyValidMove()) {
            log('🚫 Không còn nước đi cho xúc xắc còn lại. Bỏ lượt!');
            availableMoves = [];
            setTimeout(() => { endTurnOrKeep(); }, 1500);
        }
    }
}

socket.on('updateBoard', (data) => {
    const piece = pieces.find(p => p.id === data.pieceId);
    if (piece) {
        piece.state = data.newState; piece.currentPos = data.newPos;
        piece.trackIndex = data.trackIndex; piece.stepsTaken = data.stepsTaken; piece.homeIndex = data.homeIndex;
        drawBoard(); drawPieces();
    }
});

drawBoard();
initPieces();
drawPieces();