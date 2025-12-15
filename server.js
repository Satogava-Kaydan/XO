// server.js для Glitch/Render/Heroku
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

// Статические файлы
app.use(express.static('public'));

// Главная страница сервера
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🎮 Сервер для Крестиков-Ноликов</title>
        <style>
            body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #667eea; }
            .card { background: #f5f5f5; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .url { background: #fff; padding: 10px; border-radius: 5px; font-family: monospace; }
            .instructions { margin-top: 30px; }
        </style>
    </head>
    <body>
        <h1>✅ Сервер для Крестиков-Ноликов работает!</h1>
        
        <div class="card">
            <h2>🔗 Ваш URL сервера:</h2>
            <div class="url">${process.env.PROJECT_DOMAIN ? `https://${process.env.PROJECT_DOMAIN}.glitch.me` : `http://localhost:${PORT}`}</div>
            <p>Используйте этот URL в файле game.js</p>
        </div>
        
        <div class="instructions">
            <h3>📋 Инструкция:</h3>
            <ol>
                <li>Скопируйте URL выше</li>
                <li>Откройте файл game.js</li>
                <li>Замените SOCKET_SERVER на ваш URL</li>
                <li>Загрузите game.js на GitHub Pages</li>
                <li>Теперь игра будет работать!</li>
            </ol>
        </div>
        
        <div class="card">
            <h3>📊 Статистика сервера:</h3>
            <p>Активных комнат: ${rooms.size}</p>
            <p>Порт: ${PORT}</p>
        </div>
    </body>
    </html>
  `);
});

// Socket.io события
io.on('connection', (socket) => {
  console.log('🎮 Новый игрок подключился:', socket.id);

  // Создание комнаты
  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    
    rooms.set(roomId, {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      status: 'waiting',
      createdAt: new Date()
    });
    
    socket.join(roomId);
    
    console.log(`🎲 Комната создана: ${roomId}`);
    
    socket.emit('roomCreated', { 
      roomId,
      message: 'Комната создана'
    });
  });

  // Присоединение к комнате
  socket.on('joinRoom', (roomId) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', { message: 'Комната не найдена' });
      console.log(`❌ Комната ${roomId} не существует`);
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Комната заполнена' });
      console.log(`❌ Комната ${roomId} уже заполнена`);
      return;
    }
    
    room.players.push(socket.id);
    room.status = 'playing';
    socket.join(roomId);
    
    console.log(`🎯 Игрок ${socket.id} присоединился к комнате ${roomId}`);
    
    socket.emit('roomJoined', { 
      roomId: roomId.toUpperCase(),
      message: 'Вы в комнате'
    });
    
    // Назначаем символы
    const playerSymbol = room.players[0] === socket.id ? 'X' : 'O';
    socket.emit('assignSymbol', playerSymbol);
    
    // Запускаем игру
    io.to(roomId).emit('gameStart', {
      board: room.board,
      currentPlayer: room.currentPlayer
    });
  });

  // Ход игрока
  socket.on('makeMove', ({ roomId, cellIndex, symbol }) => {
    const room = rooms.get(roomId);
    
    if (!room || room.status !== 'playing') return;
    if (room.board[cellIndex] !== null) return;
    if (symbol !== room.currentPlayer) return;
    
    // Обновляем доску
    room.board[cellIndex] = symbol;
    
    console.log(`🎯 Ход в комнате ${roomId}: ${symbol} на клетку ${cellIndex}`);
    
    // Проверяем победителя
    const winner = checkWinner(room.board);
    if (winner) {
      room.status = 'finished';
      console.log(`🏆 Победитель в комнате ${roomId}: ${winner}`);
      io.to(roomId).emit('gameOver', { 
        winner, 
        board: room.board 
      });
    } else if (room.board.every(cell => cell !== null)) {
      // Ничья
      room.status = 'finished';
      console.log(`🤝 Ничья в комнате ${roomId}`);
      io.to(roomId).emit('gameOver', { 
        winner: 'draw', 
        board: room.board 
      });
    } else {
      // Меняем игрока
      room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
      io.to(roomId).emit('updateGame', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Перезапуск игры
  socket.on('restartGame', (roomId) => {
    const room = rooms.get(roomId);
    
    if (room) {
      room.board = Array(9).fill(null);
      room.currentPlayer = 'X';
      room.status = 'playing';
      
      console.log(`🔄 Игра перезапущена в комнате ${roomId}`);
      
      io.to(roomId).emit('gameRestart', {
        board: room.board,
        currentPlayer: room.currentPlayer
      });
    }
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log(`❌ Игрок отключился: ${socket.id}`);
    
    // Удаляем игрока из комнат
    for (const [roomId, room] of rooms.entries()) {
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        
        if (room.players.length === 0) {
          rooms.delete(roomId);
          console.log(`🗑️ Комната ${roomId} удалена (нет игроков)`);
        } else {
          io.to(roomId).emit('opponentDisconnected');
          console.log(`⚠️ В комнате ${roomId} остался 1 игрок`);
        }
        break;
      }
    }
  });
});

// Генерация ID комнаты
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Проверка победителя
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // строки
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // столбцы
    [0, 4, 8], [2, 4, 6]             // диагонали
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// Запуск сервера
server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 СЕРВЕР ДЛЯ КРЕСТИКОВ-НОЛИКОВ ЗАПУЩЕН');
  console.log('='.repeat(60));
  
  if (process.env.PROJECT_DOMAIN) {
    console.log(`🌐 Ваш сервер: https://${process.env.PROJECT_DOMAIN}.glitch.me`);
  } else {
    console.log(`📍 Локальный сервер: http://localhost:${PORT}`);
  }
  
  console.log('📱 Используйте этот URL в файле game.js');
  console.log('='.repeat(60) + '\n');
});
