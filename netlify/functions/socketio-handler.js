const { Server } = require('socket.io');
const { createServer } = require('http');

// 線の情報を保存する配列（実際の運用ではデータベースを使用することを推奨）
let lines = [];

// Netlify Functionsのハンドラー
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  // WebSocketサーバーのセットアップ
  const httpServer = createServer();
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('ユーザーが接続しました');
    
    // 新しい接続に現在の線の状態を送信
    socket.emit('init', lines);

    // 新しい線が引かれたときの処理
    socket.on('drawLine', (lineData) => {
      lines.push(lineData);
      socket.broadcast.emit('newLine', lineData);
    });

    // 結果表示モードに切り替わったときの処理
    socket.on('finish', () => {
      io.emit('showResults');
    });

    // リセット処理
    socket.on('reset', () => {
      lines = [];
      io.emit('reset');
    });

    // 接続が切れたときの処理
    socket.on('disconnect', () => {
      console.log('ユーザーが切断しました');
    });
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'WebSocket server is running' }),
  };
}; 