// Socket.IOの接続設定
const socket = io({
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
    autoConnect: false
});

// 接続試行回数を追跡
let connectionAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 接続を開始する関数
function startConnection() {
    if (!socket.connected) {
        socket.connect();
    }
}

// 接続エラー時の処理
socket.on('connect_error', (error) => {
    console.error('接続エラー:', error);
    connectionAttempts++;
    
    if (connectionAttempts < MAX_RECONNECT_ATTEMPTS) {
        showErrorMessage(`サーバーとの接続が切断されました。再接続を試みています... (${connectionAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        // 5秒後に再接続を試みる
        setTimeout(startConnection, 5000);
    } else {
        showErrorMessage('サーバーとの接続に失敗しました。ページを更新してください。');
    }
});

// 再接続時の処理
socket.on('reconnect', (attemptNumber) => {
    console.log(`再接続成功 (${attemptNumber}回目の試行)`);
    connectionAttempts = 0;
    hideErrorMessage();
    // 現在の状態を再取得
    socket.emit('requestState');
});

// 再接続失敗時の処理
socket.on('reconnect_failed', () => {
    console.error('再接続に失敗しました');
    showErrorMessage('サーバーとの接続に失敗しました。ページを更新してください。');
});

// エラーメッセージの表示
function showErrorMessage(message) {
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ff4444;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(errorDiv);
    }
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.style.opacity = '1';
}

// エラーメッセージの非表示
function hideErrorMessage() {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.style.opacity = '0';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 300);
    }
}

// 接続成功時の処理
socket.on('connect', () => {
    console.log('サーバーに接続しました');
    connectionAttempts = 0;
    hideErrorMessage();
});

// ページ読み込み時に接続を開始
window.addEventListener('load', () => {
    startConnection();
});

// ページがフォーカスを取得したときに再接続を試みる
window.addEventListener('focus', () => {
    if (!socket.connected) {
        startConnection();
    }
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
let animationFrameId = null;

// パスをトレースするアニメーション
function startAnimation(startIndex) {
    if (!showingResults) return;
    
    // 既存のアニメーションをキャンセル
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // 現在の位置
    let currentX = verticalPositions[startIndex];
    let currentY = 0;
    let finalX = currentX;  // 最終位置を保存
    
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 縦線を再描画
    drawVerticalLines();
    
    // 横線を再描画
    horizontalLines.forEach(line => {
        drawHorizontalLine(line.x1, line.x2, line.y);
    });
    
    // アニメーションの状態
    let lastY = 0;
    const speed = 2;
    
    // アニメーション関数
    function animate() {
        // 赤い線を描画
        ctx.beginPath();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;  // 線の太さを2pxに変更
        
        // 前回の位置から現在の位置まで線を引く
        ctx.moveTo(currentX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        
        // 交差する横線を探す
        const intersectingLine = horizontalLines.find(line => 
            Math.abs(line.y - currentY) < 5 && 
            (Math.abs(line.x1 - currentX) < 5 || Math.abs(line.x2 - currentX) < 5)
        );
        
        if (intersectingLine) {
            // 横線に沿って移動
            const nextX = Math.abs(intersectingLine.x1 - currentX) < 5 ? intersectingLine.x2 : intersectingLine.x1;
            
            // 横線を赤く描画
            ctx.beginPath();
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;  // 線の太さを2pxに変更
            ctx.moveTo(currentX, currentY);
            ctx.lineTo(nextX, currentY);
            ctx.stroke();
            
            currentX = nextX;
            finalX = currentX;  // 最終位置を更新
        }
        
        // 次の位置を計算
        lastY = currentY;
        currentY += speed;
        
        // アニメーションを続けるかどうか判定
        if (currentY <= canvas.height) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            // アニメーション終了時に結果を表示
            const resultIndex = verticalPositions.indexOf(finalX);
            if (resultIndex !== -1) {
                const resultElement = document.querySelector(`.end-input:nth-child(${resultIndex + 1})`);
                if (resultElement) {
                    // 他の結果表示をリセット
                    document.querySelectorAll('.end-input').forEach(el => {
                        el.style.backgroundColor = 'white';
                        el.style.color = 'black';
                    });
                    // 結果を強調表示
                    resultElement.style.backgroundColor = '#ff0000';
                    resultElement.style.color = 'white';
                }
            }
        }
    }
    
    // アニメーションを開始
    animate();
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
    
    // 結果表示をリセット
    document.querySelectorAll('.end-input').forEach(el => {
        el.style.backgroundColor = 'white';
        el.style.color = 'black';
    });
    
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
    
    // 結果表示をリセット
    document.querySelectorAll('.end-input').forEach(el => {
        el.style.backgroundColor = 'white';
        el.style.color = 'black';
    });
    
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

// 状態の再取得要求に対する応答
socket.on('stateUpdate', (state) => {
    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 縦線を再描画
    drawVerticalLines();
    
    // 保存されている横線を再描画
    horizontalLines = state.lines;
    horizontalLines.forEach(line => {
        drawHorizontalLine(line.x1, line.x2, line.y);
    });
    
    // 結果表示モードの更新
    showingResults = state.showingResults;
    if (showingResults) {
        const startButtons = document.querySelectorAll('.start-btn');
        startButtons.forEach(btn => {
            btn.style.display = 'inline-block';
            btn.classList.remove('active');
        });
    }
});

// 初期化を実行
init(); 