class TicTacToeGame {
    constructor() {
        this.socket = null;
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        this.isOnline = false;
        
        this.initElements();
        this.initEventListeners();
        this.initSocket();
        this.checkUrlForRoom();
    }

    initElements() {
        // Основные элементы
        this.lobby = document.getElementById('lobby');
        this.gameRoom = document.getElementById('gameRoom');
        this.chatContainer = document.getElementById('chatContainer');
        this.gameBoard = document.getElementById('gameBoard');
        this.chatMessages = document.getElementById('chatMessages');
        
        // Кнопки
        this.createRoomBtn = document.getElementById('createRoomBtn');
        this.joinRoomBtn = document.getElementById('joinRoomBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.leaveRoomBtn = document.getElementById('leaveRoomBtn');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.howToPlayBtn = document.getElementById('howToPlayBtn');
        
        // Ввод
        this.roomIdInput = document.getElementById('roomIdInput');
        this.chatInput = document.getElementById('chatInput');
        
        // Информация
        this.roomIdDisplay = document.getElementById('roomIdDisplay');
        this.gameStatus = document.getElementById('gameStatus');
        this.playerSymbolDisplay = document.getElementById('playerSymbol');
        this.currentPlayerDisplay = document.getElementById('currentPlayer');
        this.notification = document.getElementById('notification');
        this.gameLinkElement = document.getElementById('gameLink');
        this.linkContainer = document.getElementById('linkContainer');
        this.connectionStatus = document.getElementById('connectionStatus');
        
        // Модальное окно
        this.howToPlayModal = document.getElementById('howToPlayModal');
        
        // Создаем игровое поле
        this.createBoard();
    }

    initSocket() {
        // Определяем URL сервера
        const serverUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000' 
            : window.location.origin;
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupSocketEvents();
    }

    setupSocketEvents() {
        this.socket.on('connect', () => {
            console.log('✅ Подключен к серверу');
            this.isOnline = true;
            this.connectionStatus.textContent = '● Онлайн';
            this.connectionStatus.className = 'status-online';
            this.addSystemMessage('Подключено к серверу');
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Ошибка подключения:', error);
            this.isOnline = false;
            this.connectionStatus.textContent = '● Офлайн';
            this.connectionStatus.className = 'status-offline';
            this.showNotification('Сервер недоступен. Проверьте подключение.', 'warning');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Отключен от сервера:', reason);
            this.isOnline = false;
            this.connectionStatus.textContent = '● Офлайн';
            this.connectionStatus.className = 'status-offline';
        });

        // Игровые события
        this.socket.on('roomCreated', this.handleRoomCreated.bind(this));
        this.socket.on('roomJoined', this.handleRoomJoined.bind(this));
        this.socket.on('assignSymbol', this.handleAssignSymbol.bind(this));
        this.socket.on('gameStart', this.handleGameStart.bind(this));
        this.socket.on('updateGame', this.handleUpdateGame.bind(this));
        this.socket.on('gameOver', this.handleGameOver.bind(this));
        this.socket.on('gameRestart', this.handleGameRestart.bind(this));
        this.socket.on('opponentDisconnected', this.handleOpponentDisconnected.bind(this));
        this.socket.on('error', this.handleError.bind(this));
    }

    initEventListeners() {
        // Создание комнаты
        this.createRoomBtn.addEventListener('click', () => {
            if (!this.isOnline) {
                this.showNotification('Сервер недоступен', 'error');
                return;
            }
            this.socket.emit('createRoom');
            this.showNotification('Создание комнаты...');
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
                this.showNotification(`Присоединение к комнате ${roomId}...`);
            } else {
                this.showNotification('Введите 6-символьный ID комнаты', 'warning');
            }
        });

        // Перезапуск игры
        this.restartBtn.addEventListener('click', () => {
            if (this.roomId && this.isOnline) {
                this.socket.emit('restartGame', this.roomId);
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

        // Отправка сообщения
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Поделиться
        this.shareBtn.addEventListener('click', () => this.shareGame());
        
        // Как играть
        this.howToPlayBtn.addEventListener('click', () => {
            this.howToPlayModal.classList.add('active');
        });

        // Закрытие модального окна
        this.howToPlayModal.querySelector('.close-modal').addEventListener('click', () => {
            this.howToPlayModal.classList.remove('active');
        });

        // Клик вне модального окна
        this.howToPlayModal.addEventListener('click', (e) => {
            if (e.target === this.howToPlayModal) {
                this.howToPlayModal.classList.remove('active');
            }
        });
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

    checkUrlForRoom() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId && roomId.length === 6) {
            this.roomIdInput.value = roomId.toUpperCase();
            this.showNotification(`Найдена комната: ${roomId}. Нажмите "Присоединиться"`, 'info');
        }
    }

    // Обработчики событий Socket.io
    handleRoomCreated(data) {
        this.roomId = data.roomId;
        this.gameLink = data.gameLink;
        
        this.showGameRoom();
        this.roomIdDisplay.textContent = data.roomId;
        
        // Показываем ссылку
        this.gameLinkElement.href = data.gameLink;
        this.gameLinkElement.textContent = data.gameLink;
        this.linkContainer.style.display = 'block';
        
        // Обновляем URL
        window.history.replaceState({}, '', `?room=${data.roomId}`);
        
        this.showNotification('Комната создана! Скопируйте ссылку для друга', 'success');
        this.addSystemMessage(`Комната создана! ID: ${data.roomId}`);
        
        // Выводим в консоль
        console.log('🎮 Комната создана:', data.roomId);
        console.log('🔗 Ссылка:', data.gameLink);
    }

    handleRoomJoined(data) {
        this.roomId = data.roomId;
        this.gameLink = data.gameLink || `${window.location.origin}?room=${data.roomId}`;
        
        this.showGameRoom();
        this.roomIdDisplay.textContent = data.roomId;
        
        // Показываем ссылку
        this.gameLinkElement.href = this.gameLink;
        this.gameLinkElement.textContent = this.gameLink;
        this.linkContainer.style.display = 'block';
        
        this.showNotification(`Вы в комнате ${data.roomId}`, 'success');
        this.addSystemMessage(`Присоединились к комнате ${data.roomId}`);
    }

    handleAssignSymbol(symbol) {
        this.playerSymbol = symbol;
        this.playerSymbolDisplay.textContent = symbol;
        this.playerSymbolDisplay.className = symbol === 'X' ? 'symbol-x' : 'symbol-o';
        this.addSystemMessage(`Вы играете за ${symbol}`);
    }

    handleGameStart(data) {
        this.gameStatus.textContent = 'Игра началась!';
        this.updateBoard(data.board);
        this.updateCurrentPlayer(data.currentPlayer);
        this.addSystemMessage('Игра началась!');
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
            this.showNotification(isWinner ? 'Вы победили! 🎉' : 'Вы проиграли 😔', 
                isWinner ? 'success' : 'error');
        }
        
        this.updateBoard(data.board);
        this.highlightWinningCells(data.board);
    }

    handleGameRestart(data) {
        this.updateBoard(data.board);
        this.updateCurrentPlayer(data.currentPlayer);
        this.gameStatus.textContent = 'Игра началась!';
        this.clearBoardHighlights();
        this.addSystemMessage('Игра перезапущена');
    }

    handleOpponentDisconnected() {
        this.gameStatus.textContent = 'Противник отключился';
        this.showNotification('Противник отключился', 'warning');
        this.addSystemMessage('Противник отключился. Ожидание нового игрока...');
    }

    handleError(data) {
        this.showNotification(data.message, 'error');
    }

    // Игровые методы
    makeMove(cellIndex) {
        if (!this.isMyTurn || !this.playerSymbol || !this.roomId || !this.isOnline) return;
        
        const cell = document.querySelector(`.cell[data-index="${cellIndex}"]`);
        if (cell.textContent !== '') return;
        
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
            if (board[index] === 'X') cell.classList.add('x');
            if (board[index] === 'O') cell.classList.add('o');
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
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
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

    showGameRoom() {
        this.lobby.classList.remove('active');
        this.gameRoom.classList.add('active');
        this.chatContainer.style.display = 'flex';
    }

    leaveRoom() {
        this.lobby.classList.add('active');
        this.gameRoom.classList.remove('active');
        this.chatContainer.style.display = 'none';
        
        this.playerSymbol = null;
        this.roomId = null;
        this.isMyTurn = false;
        this.gameLink = null;
        
        this.roomIdInput.value = '';
        this.linkContainer.style.display = 'none';
        this.createBoard();
        
        // Очищаем чат кроме первого сообщения
        const firstMessage = this.chatMessages.querySelector('.message.system');
        this.chatMessages.innerHTML = '';
        if (firstMessage) {
            this.chatMessages.appendChild(firstMessage);
        }
        
        // Обновляем URL
        window.history.replaceState({}, '', '/');
        
        this.showNotification('Вы вышли из комнаты', 'info');
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (message && this.roomId) {
            this.addMessage('Вы', message);
            this.chatInput.value = '';
            
            // В реальном приложении здесь был бы socket.emit
            // this.socket.emit('chatMessage', { roomId: this.roomId, message });
        }
    }

    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    addSystemMessage(text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        messageDiv.textContent = text;
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    copyGameLink() {
        if (this.gameLink) {
            navigator.clipboard.writeText(this.gameLink).then(() => {
                this.showNotification('Ссылка скопирована в буфер обмена!', 'success');
            }).catch(() => {
                // Резервный метод
                const textArea = document.createElement('textarea');
                textArea.value = this.gameLink;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('Ссылка скопирована!', 'success');
            });
        }
    }

    shareGame() {
        if (this.gameLink) {
            if (navigator.share) {
                navigator.share({
                    title: 'Крестики-Нолики онлайн',
                    text: 'Присоединяйся ко мне в игре Крестики-Нолики!',
                    url: this.gameLink
                });
            } else {
                this.copyGameLink();
            }
        } else {
            this.showNotification('Сначала создайте комнату', 'warning');
        }
    }

    showNotification(message, type = 'info') {
        const notification = this.notification;
        notification.textContent = message;
        notification.className = `notification ${type} show`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
}

// Инициализация игры
document.addEventListener('DOMContentLoaded', () => {
    window.game = new TicTacToeGame();
});
