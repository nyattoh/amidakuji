const { builder } = require('@netlify/functions');
const faunadb = require('faunadb');
const q = faunadb.query;

// FaunaDBクライアントの初期化
const client = new faunadb.Client({
  secret: process.env.FAUNA_SECRET_KEY
});

// ゲームの状態を取得
async function getGameState() {
  try {
    const result = await client.query(
      q.Get(q.Match(q.Index('game_by_id'), 'current_game'))
    );
    return result.data;
  } catch (error) {
    if (error.name === 'NotFound') {
      // ゲームが存在しない場合は新しく作成
      const newGame = {
        lines: [],
        showingResults: false
      };
      await client.query(
        q.Create(q.Collection('games'), {
          data: {
            id: 'current_game',
            ...newGame
          }
        })
      );
      return newGame;
    }
    throw error;
  }
}

// ゲームの状態を更新
async function updateGameState(newState) {
  try {
    const result = await client.query(
      q.Update(
        q.Select(
          'ref',
          q.Get(q.Match(q.Index('game_by_id'), 'current_game'))
        ),
        { data: newState }
      )
    );
    return result.data;
  } catch (error) {
    console.error('Error updating game state:', error);
    throw error;
  }
}

// APIハンドラー
const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  try {
    if (event.httpMethod === 'GET') {
      const gameState = await getGameState();
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameState)
      };
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const gameState = await updateGameState(body);
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameState)
      };
    }

    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};

exports.handler = builder(handler); 