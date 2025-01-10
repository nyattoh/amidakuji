const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, '/')));

// データ保存用のディレクトリを作成
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// データを保存するファイルのパス
const DATA_FILE = path.join(DATA_DIR, 'amidakuji-state.json');

// 状態の初期化
let state = {
    lines: [],
    showingResults: false,
    lastUpdated: new Date().toISOString()
};

// 保存されたデータがあれば読み込む
function loadState() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const savedData = fs.readFileSync(DATA_FILE, 'utf8');
            const loadedState = JSON.parse(savedData);
            state = {
                ...loadedState,
                lastUpdated: new Date().toISOString()
            };
            console.log('状態を読み込みました:', state);
        }
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
        // エラー時は状態を初期化
        state = {
            lines: [],
            showingResults: false,
            lastUpdated: new Date().toISOString()
        };
    }
}

// 状態を保存する関数
function saveState() {
    try {
        state.lastUpdated = new Date().toISOString();
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
        console.log('状態を保存しました:', state);
    } catch (error) {
        console.error('データの保存に失敗しました:', error);
    }
}

// 初回起動時に状態を読み込む
loadState();

// 定期的に状態を保存（5秒ごと）
setInterval(saveState, 5000);

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');
    
    // 新しい接続に現在の状態を送信
    socket.emit('init', state.lines);
    if (state.showingResults) {
        socket.emit('finish');
    }

    // 状態の再取得要求に対する処理
    socket.on('requestState', () => {
        loadState(); // 最新の状態を読み込む
        socket.emit('stateUpdate', {
            lines: state.lines,
            showingResults: state.showingResults
        });
    });

    // 新しい線が引かれたときの処理
    socket.on('drawLine', (lineData) => {
        state.lines.push(lineData);
        socket.broadcast.emit('newLine', lineData);
        saveState();
    });

    // 結了ボタンが押されたときの処理
    socket.on('finish', () => {
        state.showingResults = true;
        io.emit('finish');
        saveState();
    });

    // リセットボタンが押されたときの処理
    socket.on('reset', () => {
        state.lines = [];
        state.showingResults = false;
        io.emit('reset');
        saveState();
    });

    // 接続が切れたときの処理
    socket.on('disconnect', () => {
        console.log('ユーザーが切断しました');
        saveState(); // 切断時に状態を保存
    });
});

// プロセス終了時に状態を保存
process.on('SIGINT', () => {
    console.log('サーバーを終了します');
    saveState();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`サーバーがポート${PORT}で起動しました`);
}); 