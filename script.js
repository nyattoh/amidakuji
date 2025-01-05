// Socket.IOの設定を更新
const socket = io('/.netlify/functions/socketio-handler', {
    path: '/socket.io',
    transports: ['websocket', 'polling']
});
const canvas = document.getElementById('amidakuji-canvas');
const ctx = canvas.getContext('2d');
const startPoints = document.getElementById('start-points');
const finishBtn = document.getElementById('finish-btn');

// キャンバスのサイズ設定
canvas.width = 600;
canvas.height = 400;

// 縦線の数と間隔
const verticalLines = 4;
const spacing = canvas.width / (verticalLines + 1);

// 縦線の位置を保存する配列
const verticalPositions = [];

// 描画された線を保存する配列
let lines = [];

// マウスの状態
let isDrawing = false;
let startX, startY;

// 結果表示モード
let showingResults = false;

// リセットボタンの要素を取得
const resetBtn = document.getElementById('reset-btn');

// 初期化
function init() {
    // 開始ポイントのボタンを作成
    for (let i = 0; i < verticalLines; i++) {
        const button = document.createElement('button');
        button.textContent = `スタート ${i + 1}`;
        button.style.display = 'none';
        button.addEventListener('click', () => startAnimation(i));
        startPoints.appendChild(button);
    }

    // 縦線を描画
    drawVerticalLines();
}

// キャンバスを再描画
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawVerticalLines();
    
    // 保存された線を描画
    lines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.startX, line.startY);
        ctx.lineTo(line.endX, line.endY);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    });
}

// 縦線を描画
function drawVerticalLines() {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    verticalPositions.length = 0;  // 配列をクリア

    for (let i = 1; i <= verticalLines; i++) {
        const x = i * spacing;
        verticalPositions.push(x);
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
}

// 線の重なりをチェック（横に連続していない場合は許可）
function isLineOverlapping(y, x1, x2) {
    return lines.some(line => {
        // Y座標が近い線を検出
        if (Math.abs(line.startY - y) < 20) {
            // X座標の範囲が重なっているかチェック
            const lineLeft = Math.min(line.startX, line.endX);
            const lineRight = Math.max(line.startX, line.endX);
            const newLeft = Math.min(x1, x2);
            const newRight = Math.max(x1, x2);

            // 線が重なっているかチェック
            return (newLeft <= lineRight && newRight >= lineLeft);
        }
        return false;
    });
}

function startDrawing(e) {
    if (showingResults) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // クリックした位置から最も近い2つの縦線を見つける
    const nearestLines = findNearestVerticalLines(mouseX);
    if (nearestLines.length === 2) {
        const [x1, x2] = nearestLines.sort((a, b) => a - b);
        
        // 同じ高さでも横に連続していない場合は許可
        if (!isLineOverlapping(mouseY, x1, x2)) {
            // 横線を作成
            const line = {
                startX: x1,
                startY: mouseY,
                endX: x2,
                endY: mouseY
            };
            
            // 線を追加して描画
            lines.push(line);
            socket.emit('drawLine', line);
            redrawCanvas();
        }
    }
}

// クリックした位置から最も近い2つの縦線を見つける
function findNearestVerticalLines(x) {
    // クリック位置の左右にある縦線を探す
    const leftLines = verticalPositions.filter(pos => pos < x);
    const rightLines = verticalPositions.filter(pos => pos > x);

    if (leftLines.length === 0 || rightLines.length === 0) return [];

    // 最も近い左右の縦線を取得
    const nearestLeft = Math.max(...leftLines);
    const nearestRight = Math.min(...rightLines);

    // クリック位置が縦線間の中央付近にある場合のみ有効
    const distance = nearestRight - nearestLeft;
    const clickOffset = x - nearestLeft;
    if (clickOffset > distance * 0.2 && clickOffset < distance * 0.8) {
        return [nearestLeft, nearestRight];
    }

    return [];
}

// 最も近い縦線のX座標を取得
function getNearestVerticalLine(x) {
    return verticalPositions.reduce((nearest, current) => {
        return Math.abs(current - x) < Math.abs(nearest - x) ? current : nearest;
    });
}

// 縦線との距離をチェック
function isNearVerticalLine(x) {
    return verticalPositions.some(pos => Math.abs(x - pos) < 10);
}

// 他のユーザーが描いた線を表示
socket.on('newLine', (lineData) => {
    lines.push(lineData);
    redrawCanvas();
});

// 初期状態の線を表示
socket.on('init', (serverLines) => {
    lines = serverLines;
    redrawCanvas();
});

// 終了ボタンのイベント
finishBtn.addEventListener('click', () => {
    showingResults = true;
    socket.emit('finish');
    showStartButtons();
});

// 結果表示モードに切り替え
socket.on('showResults', () => {
    showingResults = true;
    showStartButtons();
});

// スタートボタンを表示
function showStartButtons() {
    const buttons = startPoints.getElementsByTagName('button');
    for (let button of buttons) {
        button.style.display = 'inline-block';
    }
}

// マウスイベントの設定を変更（クリックのみに）
canvas.addEventListener('mousedown', startDrawing);

// 初期化実行
init(); 

// 結果のアニメーション
function startAnimation(startIndex) {
    // 開始位置の設定
    const startX = verticalPositions[startIndex];
    let currentX = startX;
    let currentY = 0;
    const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    const path = [];
    const usedLines = new Set(); // 使用済みの横線を記録

    // 線を辿る
    while (currentY < canvas.height) {
        // 現在の位置の横線をチェック（未使用の横線のみ）
        const horizontalLine = lines.find(line => {
            // すでに使用済みの線は除外
            if (usedLines.has(line)) return false;

            // 現在のY座標と完全に一致する横線のみを対象とする
            if (Math.abs(line.startY - currentY) > 5) return false;

            // 現在のX座標から接続している横線を探す
            return Math.abs(line.startX - currentX) < 5 || Math.abs(line.endX - currentX) < 5;
        });

        if (horizontalLine) {
            // 横線が見つかった場合、必ずその線を通る
            usedLines.add(horizontalLine); // 使用済みとしてマーク

            if (Math.abs(horizontalLine.startX - currentX) < 5) {
                // 左から右へ
                path.push({
                    type: 'horizontal',
                    startX: currentX,
                    startY: currentY,
                    endX: horizontalLine.endX,
                    endY: horizontalLine.endY
                });
                currentX = horizontalLine.endX;
                currentY = horizontalLine.endY;
            } else {
                // 右から左へ
                path.push({
                    type: 'horizontal',
                    startX: currentX,
                    startY: currentY,
                    endX: horizontalLine.startX,
                    endY: horizontalLine.startY
                });
                currentX = horizontalLine.startX;
                currentY = horizontalLine.startY;
            }
        }

        // 次の横線までの距離を計算（未使用の横線のみを対象）
        let nextY = canvas.height;
        lines.forEach(line => {
            // 未使用の横線のみをチェック
            if (!usedLines.has(line) && 
                (Math.abs(line.startX - currentX) < 5 || Math.abs(line.endX - currentX) < 5) && 
                line.startY > currentY) {
                nextY = Math.min(nextY, line.startY);
            }
        });

        // 縦線を追加
        path.push({
            type: 'vertical',
            startX: currentX,
            startY: currentY,
            endX: currentX,
            endY: nextY
        });
        currentY = nextY;
    }

    // アニメーション用の変数
    let pathIndex = 0;
    let progress = 0;
    const animationSpeed = 0.05; // アニメーションの速度

    function animate() {
        // キャンバスをクリアして再描画
        redrawCanvas();

        // これまでのパスを描画
        for (let i = 0; i < pathIndex; i++) {
            const segment = path[i];
            ctx.beginPath();
            ctx.moveTo(segment.startX, segment.startY);
            ctx.lineTo(segment.endX, segment.endY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 現在のセグメントをアニメーション
        if (pathIndex < path.length) {
            const segment = path[pathIndex];
            const dx = segment.endX - segment.startX;
            const dy = segment.endY - segment.startY;
            
            const currentX = segment.startX + dx * progress;
            const currentY = segment.startY + dy * progress;

            ctx.beginPath();
            ctx.moveTo(segment.startX, segment.startY);
            ctx.lineTo(currentX, currentY);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();

            progress += animationSpeed;

            if (progress >= 1) {
                pathIndex++;
                progress = 0;
            }

            requestAnimationFrame(animate);
        } else {
            // アニメーション終了時に結果を表示
            const endPoints = document.querySelectorAll('.end-input');
            const finalX = path[path.length - 1].endX;
            const endIndex = verticalPositions.findIndex(x => Math.abs(x - finalX) < 5);
            if (endIndex !== -1) {
                endPoints[endIndex].style.backgroundColor = color;
            }
        }
    }

    // アニメーション開始
    animate();
} 

// リセット機能
function resetGame() {
    // 描画された線をクリア
    lines = [];
    
    // 結果表示モードを解除
    showingResults = false;
    
    // スタートボタンを非表示
    const buttons = startPoints.getElementsByTagName('button');
    for (let button of buttons) {
        button.style.display = 'none';
    }
    
    // 入力欄の背景色をリセット
    const endPoints = document.querySelectorAll('.end-input');
    endPoints.forEach(input => {
        input.style.backgroundColor = '';
    });
    
    // キャンバスを再描画
    redrawCanvas();
    
    // サーバーに通知
    socket.emit('reset');
}

// リセットボタンのイベントリスナー
resetBtn.addEventListener('click', resetGame);

// サーバーからのリセット通知を受け取る
socket.on('reset', () => {
    resetGame();
}); 