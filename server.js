const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

app.use(express.static(path.join(__dirname, '/')));

// 線の情報を保存する配列
let lines = [];
let showingResults = false;

io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');
    
    // 新しい接続に現在の状態を送信
    socket.emit('init', lines);
    if (showingResults) {
        socket.emit('finish');
    }

    // 新しい線が引かれたときの処理
    socket.on('drawLine', (lineData) => {
        lines.push(lineData);
        socket.broadcast.emit('newLine', lineData);
    });

    // 結了ボタンが押されたときの処理
    socket.on('finish', () => {
        showingResults = true;
        io.emit('finish');
    });

    // リセットボタンが押されたときの処理
    socket.on('reset', () => {
        lines = [];
        showingResults = false;
        io.emit('reset');
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