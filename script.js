// APIエンドポイント
const API_URL = '/.netlify/functions/api';

// ゲームの状態を取得
async function getGameState() {
    const response = await fetch(API_URL);
    return await response.json();
}

// ゲームの状態を更新
async function updateGameState(newState) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(newState)
    });
    return await response.json();
}

// 定期的に状態を更新（ポーリング）
async function pollGameState() {
    const state = await getGameState();
    if (JSON.stringify(state.lines) !== JSON.stringify(lines)) {
        lines = state.lines;
        redrawCanvas();
    }
    if (state.showingResults !== showingResults) {
        showingResults = state.showingResults;
        if (showingResults) {
            showStartButtons();
        }
    }
}

// 1秒ごとに状態を更新
setInterval(pollGameState, 1000);

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

// 線を追加する処理を修正
async function addLine(line) {
    lines.push(line);
    await updateGameState({ lines, showingResults });
    redrawCanvas();
}

// startDrawing関数を修正
function startDrawing(e) {
    if (showingResults) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const nearestLines = findNearestVerticalLines(mouseX);
    if (nearestLines.length === 2) {
        const [x1, x2] = nearestLines.sort((a, b) => a - b);
        
        if (!isLineOverlapping(mouseY, x1, x2)) {
            const line = {
                startX: x1,
                startY: mouseY,
                endX: x2,
                endY: mouseY
            };
            
            addLine(line);
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

// 終了ボタンのイベントを修正
finishBtn.addEventListener('click', async () => {
    showingResults = true;
    await updateGameState({ lines, showingResults });
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

// 初期化時にゲームの状態を取得
async function initGame() {
    const state = await getGameState();
    lines = state.lines;
    showingResults = state.showingResults;
    if (showingResults) {
        showStartButtons();
    }
    redrawCanvas();
}

// 初期化を実行
init();
initGame();

// リセット機能を修正
async function resetGame() {
    lines = [];
    showingResults = false;
    
    const buttons = startPoints.getElementsByTagName('button');
    for (let button of buttons) {
        button.style.display = 'none';
    }
    
    const endPoints = document.querySelectorAll('.end-input');
    endPoints.forEach(input => {
        input.style.backgroundColor = '';
    });
    
    await updateGameState({ lines, showingResults });
    redrawCanvas();
}

// リセットボタンのイベントリスナー
resetBtn.addEventListener('click', resetGame);

// サーバーからのリセット通知を受け取る
socket.on('reset', () => {
    resetGame();
}); 