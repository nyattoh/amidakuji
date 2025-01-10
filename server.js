const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

app.use(express.static(path.join(__dirname, '/')));

// データを保存するファイルのパス
const DATA_FILE = path.join(__dirname, 'amidakuji-state.json');

// 状態の初期化
let state = {
    lines: [],
    showingResults: false
};

// 保存されたデータがあれば読み込む
try {
    if (fs.existsSync(DATA_FILE)) {
        const savedData = fs.readFileSync(DATA_FILE, 'utf8');
        state = JSON.parse(savedData);
    }
} catch (error) {
    console.error('データの読み込みに失敗しました:', error);
}

// 状態を保存する関数
function saveState() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(state), 'utf8');
    } catch (error) {
        console.error('データの保存に失敗しました:', error);
    }
}

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');
    
    // 新しい接続に現在の状態を送信
    socket.emit('init', state.lines);
    if (state.showingResults) {
        socket.emit('finish');
    }

    // 状態の再取得要求に対する処理
    socket.on('requestState', () => {
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
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`サーバーがポート${PORT}で起動しました`);
}); 