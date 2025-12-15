// game.js для GitHub Pages + WebSocket сервер
class TicTacToeGame {
    constructor() {
        // ================= НАСТРОЙКИ =================
        // ЗАМЕНИТЕ ЭТОТ URL НА АДРЕС ВАШЕГО СЕРВЕРА!
        // Варианты:
        // 1. Glitch.com: https://ваш-проект.glitch.me
        // 2. Render.com: https://ваш-проект.onrender.com
        // 3. Heroku: https://ваш-проект.herokuapp.com
        // 4. Демо сервер (временно): https://tic-tac-toe-socket.glitch.me
        this.SOCKET_SERVER = 'https://tic-tac-toe-socket.glitch.me';
        // ==============================================
        
        this.socket = null;
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        this.isOnline = false;
        
        this.initElements();
        this.initEventListeners();
        this.connectToServer();
        this.checkUrlForRoom();
    }

    initElements() {
        // Основные элементы
        this.lobby = document.getElementById('lobby');
        this.gameRoom = document.getElementById('gameRoom');
        this.gameBoard = document.getElementById('gameBoard');
        this.notification = document.getElementById('notification');
        
        // Кнопки
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        
        // Поля ввода
        this.roomIdInput = document.getElementById('roomIdInput');
        this.gameLinkInput = document.getElementById('gameLink');
        
        // Информационные элементы
        this.roomIdDisplay = document.getElementById('roomIdDisplay');
        this.gameStatus = document.getElementById('gameStatus');
        this.playerSymbolDisplay = document.getElementById('playerSymbol');
        this.currentPlayerDisplay = document.getElementById('currentPlayer');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.linkContainer = document.getElementById('linkContainer');
        
        // Создаем игровое поле
        this.createBoard();
    }

    createBoard() {
        this.gameBoard.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.makeMove(i));
            this.gameBoard.appendChild(cell);
        }
    }

    connectToServer() {
        console.log('🔗 Подключение к серверу:', this.SOCKET_SERVER);
        
        this.socket = io(this.SOCKET_SERVER, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000
        });

        this.setupSocketEvents();
    }

    setupSocketEvents() {
        // Подключение к серверу
        this.socket.on('connect', () => {
            console.log('✅ Подключен к серверу');
            this.isOnline = true;
            this.connectionStatus.textContent = '● Онлайн';
            this.connectionStatus.className = 'status-online';
            this.showNotification('Подключено к игровому серверу', 'success');
        });

        // Ошибка подключения
        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения:', error);
            this.isOnline = false;
            this.connectionStatus.textContent = '● Офлайн';
            this.connectionStatus.className = 'status-offline';
            this.showNotification('Сервер недоступен. Попробуйте обновить страницу или создать свой сервер на Glitch.com', 'error');
        });

        // Отключение от сервера
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Отключен от сервера:', reason);
            this.isOnline = false;
            this.connectionStatus.textContent = '● Офлайн';
            this.connectionStatus.className = 'status-offline';
        });

        // ============= ИГРОВЫЕ СОБЫТИЯ =============
        
        // Комната создана
        this.socket.on('roomCreated', (data) => {
            console.log('🎲 Комната создана:', data);
            this.handleRoomCreated(data);
        });

        // Присоединение к комнате
        this.socket.on('roomJoined', (data) => {
            console.log('🎯 Присоединился к комнате:', data);
            this.handleRoomJoined(data);
        });

        // Назначение символа (X или O)
        this.socket.on('assignSymbol', (symbol) => {
            console.log('🎭 Символ назначен:', symbol);
            this.handleAssignSymbol(symbol);
        });

        // Игра началась
        this.socket.on('gameStart', (data) => {
            console.log('🎮 Игра началась:', data);
            this.handleGameStart(data);
        });

        // Обновление игры (ход сделан)
        this.socket.on('updateGame', (data) => {
            console.log('🔄 Обновление игры:', data);
            this.handleUpdateGame(data);
        });

        // Конец игры
        this.socket.on('gameOver', (data) => {
            console.log('🏆 Конец игры:', data);
            this.handleGameOver(data);
        });

        // Перезапуск игры
        this.socket.on('gameRestart', (data) => {
            console.log('🔄 Перезапуск игры:', data);
            this.handleGameRestart(data);
        });

        // Противник отключился
        this.socket.on('opponentDisconnected', () => {
            console.log('👤 Противник отключился');
            this.handleOpponentDisconnected();
        });

        // Ошибка от сервера
        this.socket.on('error', (data) => {
            console.error('❌ Ошибка:', data);
            this.handleError(data);
        });
    }

    initEventListeners() {
        // Создание комнаты
        this.createRoomBtn.addEventListener('click', () => {
            if (!this.isOnline) {
                this.showNotification('Сервер недоступен. Создайте свой сервер на Glitch.com', 'error');
                return;
            }
            this.socket.emit('createRoom');
            this.showNotification('Создание комнаты...', 'info');
        });

        // Присоединение к комнате
        this.joinRoomBtn.addEventListener('click', () => {
            if (!this.isOnline) {
                this.showNotification('Сервер недоступен', 'error');
                return;
            }
            
            const roomId = this.roomIdInput.value.trim().toUpperCase();
            if (roomId.length === 6) {
                this.socket.emit('joinRoom', roomId);
                this.showNotification(`Присоединение к комнате ${roomId}...`, 'info');
            } else {
                this.showNotification('Введите 6-символьный ID комнаты', 'warning');
            }
        });

        // Перезапуск игры
        this.restartBtn.addEventListener('click', () => {
            if (this.roomId && this.isOnline) {
                this.socket.emit('restartGame', this.roomId);
                this.showNotification('Перезапуск игры...', 'info');
            }
        });

        // Выход из комнаты
        this.leaveRoomBtn.addEventListener('click', () => {
            this.leaveRoom();
        });

        // Копирование ссылки
        this.copyLinkBtn.addEventListener('click', () => {
            this.copyGameLink();
        });
    }

    // ============= ОБРАБОТЧИКИ СОБЫТИЙ =============

    handleRoomCreated(data) {
        this.roomId = data.roomId;
        // Формируем ссылку для игры
        this.gameLink = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
        
        this.showGameRoom();
        this.roomIdDisplay.textContent = data.roomId;
        
        // Показываем ссылку
        this.gameLinkInput.value = this.gameLink;
        this.linkContainer.style.display = 'block';
        
        // Обновляем URL в адресной строке
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
        window.history.pushState({}, '', newUrl);
        
        this.showNotification('Комната создана! Скопируйте ссылку для друга', 'success');
        console.log('🎮 ID комнаты:', data.roomId);
        console.log('🔗 Ссылка для друга:', this.gameLink);
    }

    handleRoomJoined(data) {
        this.roomId = data.roomId;
        this.gameLink = `${window.location.origin}${window.location.pathname}?room=${data.roomId}`;
        
        this.showGameRoom();
        this.roomIdDisplay.textContent = data.roomId;
        
        // Показываем ссылку
        this.gameLinkInput.value = this.gameLink;
        this.linkContainer.style.display = 'block';
        
        this.showNotification(`Вы присоединились к комнате ${data.roomId}`, 'success');
    }

    handleAssignSymbol(symbol) {
        this.playerSymbol = symbol;
        this.playerSymbolDisplay.textContent = symbol;
        this.playerSymbolDisplay.className = symbol === 'X' ? 'symbol-x' : 'symbol-o';
        this.showNotification(`Вы играете за ${symbol}`, 'info');
    }

    handleGameStart(data) {
        this.gameStatus.textContent = 'Игра началась!';
        this.updateBoard(data.board);
        this.updateCurrentPlayer(data.currentPlayer);
    }

    handleUpdateGame(data) {
        this.updateBoard(data.board);
        this.updateCurrentPlayer(data.currentPlayer);
    }

    handleGameOver(data) {
        if (data.winner === 'draw') {
            this.gameStatus.textContent = 'Ничья!';
            this.showNotification('Ничья!', 'info');
        } else {
            this.gameStatus.textContent = `Победитель: ${data.winner}`;
            const isWinner = data.winner === this.playerSymbol;
            this.showNotification(
                isWinner ? '🎉 Вы победили!' : '😔 Вы проиграли', 
                isWinner ? 'success' : 'error'
            );
        }
        
        this.updateBoard(data.board);
        this.highlightWinningCells(data.board);
    }

    handleGameRestart(data) {
        this.updateBoard(data.board);
        this.updateCurrentPlayer(data.currentPlayer);
        this.gameStatus.textContent = 'Игра началась!';
        this.clearBoardHighlights();
        this.showNotification('Игра перезапущена', 'info');
    }

    handleOpponentDisconnected() {
        this.gameStatus.textContent = 'Противник отключился';
        this.showNotification('Противник отключился. Ожидание нового игрока...', 'warning');
    }

    handleError(data) {
        this.showNotification(data.message, 'error');
    }

    // ============= ИГРОВАЯ ЛОГИКА =============

    makeMove(cellIndex) {
        if (!this.isMyTurn || !this.playerSymbol || !this.roomId || !this.isOnline) {
            this.showNotification('Сейчас не ваш ход или сервер недоступен', 'warning');
            return;
        }
        
        const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
        if (cell.textContent !== '') {
            this.showNotification('Эта клетка уже занята!', 'warning');
            return;
        }
        
        this.socket.emit('makeMove', {
            roomId: this.roomId,
            cellIndex: cellIndex,
            symbol: this.playerSymbol
        });
    }

    updateBoard(board) {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = board[index] || '';
            cell.className = 'cell';
            if (board[index] === 'X') {
                cell.classList.add('x');
            } else if (board[index] === 'O') {
                cell.classList.add('o');
            }
        });
    }

    updateCurrentPlayer(currentPlayer) {
        this.currentPlayerDisplay.textContent = currentPlayer;
        this.currentPlayerDisplay.className = currentPlayer === 'X' ? 'symbol-x' : 'symbol-o';
        this.isMyTurn = currentPlayer === this.playerSymbol;
        
        if (this.isMyTurn) {
            this.gameStatus.textContent = 'Ваш ход!';
        } else {
            this.gameStatus.textContent = 'Ход противника...';
        }
    }

    highlightWinningCells(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Горизонтальные линии
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Вертикальные линии
            [0, 4, 8], [2, 4, 6]             // Диагонали
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                pattern.forEach(index => {
                    const cell = document.querySelector(`.cell[data-index="${index}"]`);
                    cell.style.backgroundColor = '#e8f5e9';
                    cell.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.5)';
                });
                break;
            }
        }
    }

    clearBoardHighlights() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.backgroundColor = '';
            cell.style.boxShadow = '';
        });
    }

    // ============= УТИЛИТЫ =============

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId && roomId.length === 6) {
            this.roomIdInput.value = roomId.toUpperCase();
            this.showNotification(`Найдена комната: ${roomId}. Нажмите "Присоединиться"`, 'info');
            
            // Автоматически присоединяемся к комнате через 1 секунду
            setTimeout(() => {
                if (this.isOnline && !this.roomId) {
                    this.joinRoomBtn.click();
                }
            }, 1000);
        }
    }

    copyGameLink() {
        if (this.gameLink) {
            this.gameLinkInput.select();
            this.gameLinkInput.setSelectionRange(0, 99999); // Для мобильных
            
            try {
                navigator.clipboard.writeText(this.gameLink).then(() => {
                    this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
                }).catch(() => {
                    document.execCommand('copy');
                    this.showNotification('Ссылка скопирована!', 'success');
                });
            } catch (err) {
                document.execCommand('copy');
                this.showNotification('Ссылка скопирована!', 'success');
            }
        } else {
            this.showNotification('Ссылка еще не создана', 'warning');
        }
    }

    showGameRoom() {
        this.lobby.classList.remove('active');
        this.gameRoom.classList.add('active');
    }

    leaveRoom() {
        // Сброс состояния игры
        this.lobby.classList.add('active');
        this.gameRoom.classList.remove('active');
        
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        
        this.roomIdInput.value = '';
        this.linkContainer.style.display = 'none';
        this.createBoard();
        
        // Возвращаемся на главную страницу
        window.history.pushState({}, '', window.location.pathname);
        
        this.showNotification('Вы вышли из комнаты', 'info');
    }

    showNotification(message, type = 'info') {
        const notification = this.notification;
        notification.textContent = message;
        
        // Устанавливаем цвет уведомления
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        notification.style.backgroundColor = colors[type] || '#333';
        notification.classList.add('show');
        
        // Автоматическое скрытие
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// ============= ЗАПУСК ИГРЫ =============

// Ждем полной загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Запуск игры Крестики-Нолики...');
    
    // Создаем экземпляр игры
    window.game = new TicTacToeGame();
    
    // Добавляем глобальные обработчики
    window.addEventListener('beforeunload', () => {
        if (window.game && window.game.socket) {
            window.game.socket.disconnect();
        }
    });
    
    // Обновляем статус подключения каждые 30 секунд
    setInterval(() => {
        if (window.game && window.game.socket && !window.game.socket.connected) {
            window.game.socket.connect();
        }
    }, 30000);
    
    console.log('✅ Игра успешно инициализирована');
    console.log('💡 Чтобы игра работала, вам нужно:');
    console.log('1. Создать свой сервер на Glitch.com (бесплатно)');
    console.log('2. Заменить SOCKET_SERVER в коде на ваш URL');
    console.log('3. Загрузить файлы на GitHub Pages');
});
