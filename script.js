// Socket.IOの接続設定
const socket = io({
    path: '/socket.io',
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

socket.on('connect_error', (error) => {
    console.error('Connection Error:', error);
});

socket.on('connect', () => {
    console.log('Connected to server');
});

const canvas = document.getElementById('amidakuji-canvas');
const ctx = canvas.getContext('2d');
const startPoints = document.getElementById('start-points');
const finishBtn = document.getElementById('finish-btn');
const resetBtn = document.getElementById('reset-btn');

// キャンバスのサイズをDOMのサイズに合わせる
function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

// 初期化時とウィンドウリサイズ時にキャンバスサイズを調整
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// 縦線の数と間隔
const verticalLines = 4;
let spacing;

// 縦線の位置を保存する配列
const verticalPositions = [];

// 横線の情報を保存する配列
let horizontalLines = [];

// マウスの状態
let isDrawing = false;
let startX, startY;

// 結果表示モード
let showingResults = false;

// 初期化
function init() {
    // 縦線の間隔を計算
    spacing = canvas.width / (verticalLines + 1);
    verticalPositions.length = 0;

    // 開始ポイントのボタンを作成
    startPoints.innerHTML = '';
    for (let i = 0; i < verticalLines; i++) {
        const button = document.createElement('button');
        button.textContent = `スタート ${i + 1}`;
        button.classList.add('start-btn');
        button.addEventListener('click', () => startAnimation(i));
        startPoints.appendChild(button);
    }

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 縦線を描画
    drawVerticalLines();
    
    // 横線の配列をリセット
    horizontalLines = [];
    
    // 結果表示モードをリセット
    showingResults = false;
    
    // スタートボタンを非表示
    const startButtons = document.querySelectorAll('.start-btn');
    startButtons.forEach(btn => {
        btn.style.display = 'none';
        btn.classList.remove('active');
    });
}

// 縦線を描画
function drawVerticalLines() {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;

    for (let i = 1; i <= verticalLines; i++) {
        const x = i * spacing;
        verticalPositions.push(x);
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

// 横線を描画
function drawHorizontalLine(x1, x2, y) {
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// 既存の線と重なっていないかチェック
function isLineOverlapping(y) {
    const threshold = 20; // 最小の垂直距離
    for (const line of horizontalLines) {
        if (Math.abs(line.y - y) < threshold) {
            return true;
        }
    }
    return false;
}

// クリックした位置が縦線の近くかチェック
function getNearestVerticalLine(x) {
    let nearest = null;
    let minDistance = Infinity;
    
    verticalPositions.forEach(pos => {
        const distance = Math.abs(pos - x);
        if (distance < minDistance) {
            minDistance = distance;
            nearest = pos;
        }
    });
    
    return nearest;
}

// クリックイベントの処理
canvas.addEventListener('click', (e) => {
    if (showingResults) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 既存の線と重なっていないかチェック
    if (isLineOverlapping(y)) return;

    // クリックした位置に最も近い縦線を見つける
    const nearestX = getNearestVerticalLine(x);
    if (!nearestX) return;

    // クリックした位置が2本の縦線の間にあるかチェック
    const lineIndex = verticalPositions.indexOf(nearestX);
    if (lineIndex === -1) return;

    let x1, x2;
    const clickOffset = x - nearestX;
    
    // 横線が既に存在するかチェック
    const existingLine = horizontalLines.find(line => 
        Math.abs(line.y - y) < 20 && 
        ((line.x1 === verticalPositions[lineIndex - 1] && line.x2 === nearestX) ||
         (line.x1 === nearestX && line.x2 === verticalPositions[lineIndex + 1]))
    );
    if (existingLine) return;

    if (clickOffset < 0 && lineIndex > 0) {
        // 左側の線を引く
        x1 = verticalPositions[lineIndex - 1];
        x2 = nearestX;
    } else if (clickOffset > 0 && lineIndex < verticalPositions.length - 1) {
        // 右側の線を引く
        x1 = nearestX;
        x2 = verticalPositions[lineIndex + 1];
    } else {
        return;
    }

    // 横線を描画
    drawHorizontalLine(x1, x2, y);
    
    // 線の情報を保存
    horizontalLines.push({ x1, x2, y });
    
    // WebSocketで他のクライアントに通知
    socket.emit('drawLine', { x1, x2, y });
});

// 他のクライアントが描いた線を表示
socket.on('newLine', (lineData) => {
    drawHorizontalLine(lineData.x1, lineData.x2, lineData.y);
    horizontalLines.push(lineData);
});

// アニメーション用の変数
let currentPath = [];
let animationFrameId = null;

// パスをトレースするアニメーション
function startAnimation(startIndex) {
    if (!showingResults) return;
    
    // 既存のアニメーションをキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    currentPath = [];
    let currentX = verticalPositions[startIndex];
    let currentY = 0;
    let pathPoints = [];
    
    // パスを計算
    while (currentY < canvas.height) {
        pathPoints.push({ x: currentX, y: currentY });
        
        // 交差する横線を探す
        const intersectingLine = horizontalLines.find(line => 
            Math.abs(line.y - currentY) < 10 && 
            (Math.abs(line.x1 - currentX) < 2 || Math.abs(line.x2 - currentX) < 2)
        );
        
        if (intersectingLine) {
            // 横線に沿って移動
            currentX = Math.abs(intersectingLine.x1 - currentX) < 2 ? intersectingLine.x2 : intersectingLine.x1;
            currentY = intersectingLine.y;
        } else {
            currentY += 2;
        }
    }
    
    // 最終位置を追加
    pathPoints.push({ x: currentX, y: canvas.height });
    
    // アニメーションの状態
    let progress = 0;
    const animationDuration = 1000; // 1秒
    const startTime = performance.now();
    
    // アニメーション関数
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        progress = Math.min(elapsed / animationDuration, 1);
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 縦線を再描画
        drawVerticalLines();
        
        // 横線を再描画
        horizontalLines.forEach(line => {
            drawHorizontalLine(line.x1, line.x2, line.y);
        });
        
        // パスを描画
        const currentPoint = Math.floor(progress * pathPoints.length);
        
        if (currentPoint > 0) {
            ctx.beginPath();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 3;
            
            ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
            for (let i = 1; i <= currentPoint; i++) {
                ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
            }
            ctx.stroke();
        }
        
        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        }
    }
    
    // アニメーションを開始
    animationFrameId = requestAnimationFrame(animate);
}

// 終了ボタンのイベント
finishBtn.addEventListener('click', () => {
    showingResults = true;
    const startButtons = document.querySelectorAll('.start-btn');
    startButtons.forEach(btn => {
        btn.style.display = 'inline-block';
        btn.classList.add('active');
    });
    socket.emit('finish');
});

// リセットボタンのイベント
resetBtn.addEventListener('click', () => {
    // アニメーションをキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // 状態をリセット
    currentPath = [];
    horizontalLines = [];
    showingResults = false;
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 初期化を実行
    init();
    
    // 他のクライアントに通知
    socket.emit('reset');
});

// 他のクライアントが終了したときの処理
socket.on('finish', () => {
    showingResults = true;
    const startButtons = document.querySelectorAll('.start-btn');
    startButtons.forEach(btn => {
        btn.style.display = 'inline-block';
        btn.classList.add('active');
    });
});

// 他のクライアントがリセットしたときの処理
socket.on('reset', () => {
    // アニメーションをキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // 状態をリセット
    currentPath = [];
    horizontalLines = [];
    showingResults = false;
    
    // 初期化を実行
    init();
});

// 初期状態の線を表示
socket.on('init', (lines) => {
    horizontalLines = lines;
    lines.forEach(line => {
        drawHorizontalLine(line.x1, line.x2, line.y);
    });
});

// 初期化を実行
init(); 