class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.gameArea = document.querySelector('.game-area');
        this.setupResponsiveCanvas();
        
        // Game state
        this.gameStarted = false;
        this.gameOver = false;
        this.score = 0;
        this.combo = 1;
        this.timeLeft = 60;
        this.lastPopTime = 0;
        this.pops = [];
        this.currentRule = null;
        this.ruleChangeTime = 0;
        this.speedMultiplier = 0.8; // Start with a slower base speed
        
        // Multiplayer state
        this.playerId = this.generatePlayerId();
        this.players = new Map();
        this.websocket = null;
        this.isHost = false;
        
        // Game settings
        this.settings = {
            popInterval: 2000, // Start with 2 seconds between pops
            minPopInterval: 800, // Minimum 0.8 seconds between pops
            ruleChangeInterval: 8000, // Change rules every 8 seconds
            popSize: 40,
            popColors: [
                { name: 'Red', value: '#ff0000' },
                { name: 'Green', value: '#00ff00' },
                { name: 'Blue', value: '#0000ff' },
                { name: 'Yellow', value: '#ffff00' },
                { name: 'Purple', value: '#ff00ff' }
            ],
            popShapes: ['circle', 'square', 'triangle', 'star']
        };
        
        // Audio context
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.soundEnabled = true;
        this.setupSounds();
        
        // Load saved scores
        this.savedScores = JSON.parse(localStorage.getItem('pixelPopScores')) || [];
        
        // Front page elements
        this.frontPage = document.getElementById('frontPage');
        this.gameContainer = document.getElementById('gameContainer');
        this.userNameInput = document.getElementById('userName');
        this.walletAddressInput = document.getElementById('walletAddressInput');
        this.connectWalletButton = document.getElementById('connectWallet');
        this.walletStatus = document.getElementById('walletStatus');
        this.walletAddress = document.getElementById('walletAddress');
        this.addressDisplay = document.getElementById('addressDisplay');
        this.startGameButton = document.getElementById('startGame');
        
        // Game state
        this.userName = '';
        this.walletConnected = false;
        this.walletAddress = localStorage.getItem('walletAddress') || '';
        
        this.playerData = {
            highScore: 0,
            totalCoins: 0,
            gamesPlayed: 0
        };
        
        this.loadPlayerData();
        
        // Setup front page event listeners
        this.setupFrontPage();
        
        // Setup controls
        this.setupControls();
        
        // Connect to WebSocket server
        this.lastTime = performance.now();
        
        // Wallet state
        this.coins = parseInt(localStorage.getItem('pixelPopCoins')) || 0;
        this.coinsEarned = 0;
        this.purchasedItems = JSON.parse(localStorage.getItem('pixelPopPurchasedItems')) || [];
        
        // Update wallet display
        this.updateWalletDisplay();
        
        // Setup shop
        this.setupShop();
        
        // Start game loop
        this.gameLoop();
        
        // Add room management
        this.roomId = null;
        this.roomCode = null;
        
        // Add room UI elements
        this.roomContainer = document.createElement('div');
        this.roomContainer.className = 'room-container';
        this.roomContainer.innerHTML = `
            <div class="room-controls">
                <button id="createRoom">Create Room</button>
                <div class="room-input">
                    <input type="text" id="roomCode" placeholder="Enter room code">
                    <button id="joinRoom">Join Room</button>
                </div>
            </div>
            <div class="room-info">
                <p>Room Code: <span id="currentRoom">-</span></p>
                <p>Players: <span id="playerCount">0</span></p>
            </div>
        `;
        document.querySelector('.game-container').appendChild(this.roomContainer);
        
        // Add room event listeners
        this.setupRoomControls();
    }
    
    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }
    
    connectToServer() {
        if (this.websocket) {
            this.websocket.close();
        }
        
        this.websocket = new WebSocket('ws://localhost:3000');
        
        this.websocket.onopen = () => {
            console.log('Connected to server');
            this.sendMessage({
                type: 'join',
                playerId: this.playerId,
                playerName: this.playerName,
                walletAddress: this.walletAddress,
                roomId: this.roomId
            });
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'players') {
                this.handlePlayersUpdate(data.players);
            } else if (data.type === 'scores') {
                this.handleScoresUpdate(data.scores);
            }
        };
        
        this.websocket.onclose = () => {
            console.log('Disconnected from server');
        };
    }
    
    sendMessage(message) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(message));
        }
    }
    
    handlePlayersUpdate(players) {
        this.players.clear();
        players.forEach(player => {
            this.players.set(player.id, player);
        });
        
        // Update players list display
        this.updatePlayersList();
    }
    
    handleScoresUpdate(scores) {
        // Update leaderboard
        this.updateLeaderboard(scores);
    }
    
    updatePlayersList() {
        const playersList = document.querySelector('.players-list');
        playersList.innerHTML = '';
        
        this.players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-entry';
            playerElement.innerHTML = `
                <span class="player-name">${player.name}</span>
                <span class="player-score">${player.score}</span>
                <span class="player-combo">x${player.combo}</span>
            `;
            playersList.appendChild(playerElement);
        });
    }
    
    updateLeaderboard(scores) {
        const leaderboardList = document.querySelector('.leaderboard-list');
        leaderboardList.innerHTML = '';
        
        scores.forEach((score, index) => {
            const entry = document.createElement('div');
            entry.className = 'leaderboard-entry';
            entry.innerHTML = `
                <span class="rank">${index + 1}.</span>
                <span class="name">${score.name}</span>
                <span class="score">${score.score}</span>
                <span class="combo">x${score.combo}</span>
            `;
            leaderboardList.appendChild(entry);
        });
    }
    
    setupResponsiveCanvas() {
        const resizeCanvas = () => {
            const containerWidth = this.gameArea.clientWidth;
            const containerHeight = this.gameArea.clientHeight;
            
            // Maintain aspect ratio
            const aspectRatio = 16/9;
            let width = containerWidth;
            let height = width / aspectRatio;
            
            if (height > containerHeight) {
                height = containerHeight;
                width = height * aspectRatio;
            }
            
            this.canvas.width = width;
            this.canvas.height = height;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupSounds() {
        this.sounds = {
            pop: this.createPopSound(),
            wrong: this.createWrongSound(),
            ruleChange: this.createRuleChangeSound(),
            gameover: this.createGameOverSound(),
            background: this.createBackgroundSound(),
            combo: this.createComboSound()
        };
    }
    
    createPopSound() {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // More interesting "pop" sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800 + Math.random() * 200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400 + Math.random() * 100, this.audioContext.currentTime + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(600 + Math.random() * 100, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        };
    }
    
    createWrongSound() {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // More interesting "wrong" sound
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(300 + Math.random() * 100, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100 + Math.random() * 50, this.audioContext.currentTime + 0.3);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.3);
        };
    }
    
    createRuleChangeSound() {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Fun "whoosh" sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(200, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        };
    }
    
    createGameOverSound() {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Sad trombone sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(220, this.audioContext.currentTime + 0.5);
            oscillator.frequency.exponentialRampToValueAtTime(110, this.audioContext.currentTime + 1);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 1);
        };
    }
    
    createComboSound() {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // More interesting combo sound
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(1000 + Math.random() * 200, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200 + Math.random() * 200, this.audioContext.currentTime + 0.1);
            oscillator.frequency.exponentialRampToValueAtTime(800 + Math.random() * 100, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.2);
        };
    }
    
    createBackgroundSound() {
        let oscillators = [];
        let gainNodes = [];
        
        return {
            play: () => {
                if (oscillators.length > 0) return;
                
                // Create a more complex melody sequence
                const melody = [
                    { note: 440, duration: 0.3 },  // A4
                    { note: 523.25, duration: 0.3 }, // C5
                    { note: 587.33, duration: 0.3 }, // D5
                    { note: 659.25, duration: 0.3 }, // E5
                    { note: 587.33, duration: 0.3 }, // D5
                    { note: 523.25, duration: 0.3 }, // C5
                    { note: 440, duration: 0.3 },   // A4
                    { note: 392, duration: 0.3 },   // G4
                    { note: 440, duration: 0.6 }    // A4
                ];
                
                let currentTime = this.audioContext.currentTime;
                
                // Create a repeating melody with variations
                const playMelody = () => {
                    melody.forEach((note, index) => {
                        const oscillator = this.audioContext.createOscillator();
                        const gainNode = this.audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(this.audioContext.destination);
                        
                        // Use different wave types for variety
                        const waveTypes = ['sine', 'square', 'triangle', 'sawtooth'];
                        oscillator.type = waveTypes[index % waveTypes.length];
                        
                        // Add vibrato for more interesting sound
                        const vibrato = this.audioContext.createOscillator();
                        const vibratoGain = this.audioContext.createGain();
                        
                        vibrato.connect(vibratoGain);
                        vibratoGain.connect(oscillator.frequency);
                        
                        vibrato.type = 'sine';
                        vibrato.frequency.setValueAtTime(5 + Math.random() * 3, currentTime);
                        vibratoGain.gain.setValueAtTime(3 + Math.random() * 2, currentTime);
                        
                        oscillator.frequency.setValueAtTime(note.note, currentTime);
                        
                        // Add envelope with slight randomization
                        gainNode.gain.setValueAtTime(0, currentTime);
                        gainNode.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.05, currentTime + 0.05);
                        gainNode.gain.linearRampToValueAtTime(0, currentTime + note.duration);
                        
                        oscillator.start(currentTime);
                        oscillator.stop(currentTime + note.duration);
                        vibrato.start(currentTime);
                        vibrato.stop(currentTime + note.duration);
                        
                        oscillators.push(oscillator);
                        gainNodes.push(gainNode);
                        
                        currentTime += note.duration;
                    });
                    
                    // Add some randomization to the timing
                    const randomDelay = 100 + Math.random() * 200;
                    
                    // Repeat the melody with variations
                    if (this.soundEnabled) {
                        setTimeout(playMelody, randomDelay);
                    }
                };
                
                // Add a continuous bass line
                const bassOscillator = this.audioContext.createOscillator();
                const bassGain = this.audioContext.createGain();
                
                bassOscillator.connect(bassGain);
                bassGain.connect(this.audioContext.destination);
                
                bassOscillator.type = 'sine';
                bassOscillator.frequency.setValueAtTime(110, this.audioContext.currentTime);
                
                // Add a low-pass filter for the bass
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(200, this.audioContext.currentTime);
                
                bassGain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
                
                bassOscillator.start();
                oscillators.push(bassOscillator);
                gainNodes.push(bassGain);
                
                // Add a continuous high-pitched background sound
                const backgroundOscillator = this.audioContext.createOscillator();
                const backgroundGain = this.audioContext.createGain();
                
                backgroundOscillator.connect(backgroundGain);
                backgroundGain.connect(this.audioContext.destination);
                
                backgroundOscillator.type = 'sine';
                backgroundOscillator.frequency.setValueAtTime(880, this.audioContext.currentTime);
                
                backgroundGain.gain.setValueAtTime(0.02, this.audioContext.currentTime);
                
                backgroundOscillator.start();
                oscillators.push(backgroundOscillator);
                gainNodes.push(backgroundGain);
                
                // Start the melody
                playMelody();
            },
            pause: () => {
                oscillators.forEach(oscillator => {
                    oscillator.stop();
                });
                oscillators = [];
                gainNodes = [];
            }
        };
    }
    
    setupControls() {
        // Touch/mouse controls
        this.canvas.addEventListener('mousedown', (e) => this.handlePop(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePop(e);
        });
        
        // Sound toggle
        const soundToggle = document.querySelector('.sound-toggle');
        soundToggle.addEventListener('click', () => {
            this.soundEnabled = !this.soundEnabled;
            soundToggle.textContent = this.soundEnabled ? '🔊 Sound On' : '🔈 Sound Off';
            
            // Save sound preference
            localStorage.setItem('pixelPopSoundEnabled', this.soundEnabled);
            
            // Handle background music
            if (this.soundEnabled) {
                this.sounds.background.play();
            } else {
                this.sounds.background.pause();
            }
        });
        
        // Load sound preference
        const savedSoundEnabled = localStorage.getItem('pixelPopSoundEnabled');
        if (savedSoundEnabled !== null) {
            this.soundEnabled = savedSoundEnabled === 'true';
            soundToggle.textContent = this.soundEnabled ? '🔊 Sound On' : '🔈 Sound Off';
        }
        
        // Start game button
        const startButton = document.getElementById('startButton');
        startButton.addEventListener('click', () => this.startGame());
        
        // Restart game button
        const restartButton = document.getElementById('restartButton');
        restartButton.addEventListener('click', () => this.startGame());
    }
    
    setupPlayerName() {
        const nameInput = document.getElementById('playerName');
        const nameDisplay = document.getElementById('displayName');
        
        // Set initial display
        if (this.playerName) {
            nameInput.value = this.playerName;
            nameDisplay.textContent = this.playerName;
            nameInput.style.display = 'none';
            nameDisplay.style.display = 'inline';
        } else {
            nameDisplay.style.display = 'none';
        }
        
        // Handle name input
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.playerName = nameInput.value.trim();
                if (this.playerName) {
                    localStorage.setItem('pixelPopPlayerName', this.playerName);
                    nameDisplay.textContent = this.playerName;
                    nameInput.style.display = 'none';
                    nameDisplay.style.display = 'inline';
                }
            }
        });
        
        // Allow editing name by clicking display
        nameDisplay.addEventListener('click', () => {
            nameInput.style.display = 'inline';
            nameDisplay.style.display = 'none';
            nameInput.focus();
        });
    }
    
    generateRule() {
        const ruleTypes = [
            { type: 'color', value: this.settings.popColors[Math.floor(Math.random() * this.settings.popColors.length)].name },
            { type: 'shape', value: this.settings.popShapes[Math.floor(Math.random() * this.settings.popShapes.length)] }
        ];
        
        const rule = ruleTypes[Math.floor(Math.random() * ruleTypes.length)];
        this.currentRule = rule;
        
        // Update rule display
        const ruleText = rule.type === 'color' 
            ? `Tap the ${rule.value} shapes!` 
            : `Tap the ${rule.value}s!`;
        
        document.getElementById('currentRule').textContent = ruleText;
        
        if (this.soundEnabled) {
            this.sounds.ruleChange();
        }
    }
    
    createPop() {
        const pop = {
            x: Math.random() * (this.canvas.width - this.settings.popSize),
            y: Math.random() * (this.canvas.height - this.settings.popSize),
            size: this.settings.popSize,
            color: this.settings.popColors[Math.floor(Math.random() * this.settings.popColors.length)],
            shape: this.settings.popShapes[Math.floor(Math.random() * this.settings.popShapes.length)],
            createdAt: performance.now()
        };
        
        this.pops.push(pop);
    }
    
    handlePop(e) {
        if (!this.gameStarted || this.gameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        
        this.pops.forEach((pop, index) => {
            if (this.checkCollision({x, y}, pop)) {
                const isCorrect = this.currentRule.type === 'color' 
                    ? pop.color.name === this.currentRule.value
                    : pop.shape === this.currentRule.value;
                
                if (isCorrect) {
                    // Correct pop
                    this.score += 10 * this.combo;
                    this.combo++;
                    
                    // Earn coins for correct pops
                    this.earnCoins(this.combo);
                    
                    if (this.soundEnabled) {
                        this.sounds.pop();
                        if (this.combo > 2) {
                            this.sounds.combo();
                        }
                    }
                } else {
                    // Wrong pop
                    this.combo = 1;
                    if (this.soundEnabled) this.sounds.wrong();
                }
                
                this.pops.splice(index, 1);
            }
        });
    }
    
    checkCollision(point, pop) {
        return point.x >= pop.x && point.x <= pop.x + pop.size &&
               point.y >= pop.y && point.y <= pop.y + pop.size;
    }
    
    update(deltaTime) {
        if (!this.gameStarted || this.gameOver) return;
        
        const currentTime = performance.now();
        
        // Increase speed multiplier based on score, but more gradually
        this.speedMultiplier = 0.8 + (this.score / 2000); // Changed from 500 to 2000 for slower progression
        
        // Spawn new pops
        if (currentTime - this.lastPopTime > (this.settings.popInterval / this.speedMultiplier)) {
            this.createPop();
            this.lastPopTime = currentTime;
            
            // Gradually decrease pop interval more slowly
            this.settings.popInterval = Math.max(
                this.settings.minPopInterval,
                this.settings.popInterval - 10 // Decreased from 40 to 10
            );
        }
        
        // Change rules less frequently
        if (currentTime - this.ruleChangeTime > (this.settings.ruleChangeInterval / this.speedMultiplier)) {
            this.generateRule();
            this.ruleChangeTime = currentTime;
        }
        
        // Update time
        this.timeLeft -= deltaTime / 1000;
        if (this.timeLeft <= 0) {
            this.endGame();
        }
        
        // Update stats display
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = `x${this.combo}`;
        document.getElementById('time').textContent = Math.ceil(this.timeLeft);
        
        // Send score update to server
        this.sendMessage({
            type: 'score',
            playerId: this.playerId,
            score: this.score,
            combo: this.combo
        });
    }
    
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw pops
        this.pops.forEach(pop => {
            this.ctx.fillStyle = pop.color.value;
            
            switch(pop.shape) {
                case 'circle':
                    this.ctx.beginPath();
                    this.ctx.arc(pop.x + pop.size/2, pop.y + pop.size/2, pop.size/2, 0, Math.PI * 2);
                    this.ctx.fill();
                    break;
                    
                case 'square':
                    this.ctx.fillRect(pop.x, pop.y, pop.size, pop.size);
                    break;
                    
                case 'triangle':
                    this.ctx.beginPath();
                    this.ctx.moveTo(pop.x + pop.size/2, pop.y);
                    this.ctx.lineTo(pop.x, pop.y + pop.size);
                    this.ctx.lineTo(pop.x + pop.size, pop.y + pop.size);
                    this.ctx.fill();
                    break;
                    
                case 'star':
                    this.drawStar(pop.x + pop.size/2, pop.y + pop.size/2, pop.size/2);
                    break;
            }
        });
        
        // Draw game over screen
        if (this.gameOver) {
            this.drawGameOver();
        }
    }
    
    drawStar(cx, cy, radius) {
        this.ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;
            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawGameOver() {
        const gameOverScreen = document.querySelector('.game-over');
        gameOverScreen.style.display = 'block';
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalCombo').textContent = `x${this.combo}`;
        document.getElementById('coinsEarned').textContent = this.coinsEarned;
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    startGame() {
        this.gameStarted = true;
        this.gameOver = false;
        this.score = 0;
        this.combo = 1;
        this.timeLeft = 60;
        this.coinsEarned = 0;
        this.pops = [];
        this.settings.popInterval = 2000; // Reset to initial slow speed
        this.speedMultiplier = 0.8; // Start with slower base speed
        
        // Hide game over screen
        document.querySelector('.game-over').style.display = 'none';
        
        // Update displays
        document.getElementById('score').textContent = this.score;
        document.getElementById('combo').textContent = `x${this.combo}`;
        document.getElementById('time').textContent = this.timeLeft;
        document.getElementById('coinsEarned').textContent = this.coinsEarned;
        
        this.generateRule();
        
        if (this.soundEnabled) {
            this.sounds.background.play();
        }
        
        // Notify server
        this.sendMessage({ type: 'start' });
    }
    
    endGame() {
        this.gameStarted = false;
        this.gameOver = true;
        
        if (this.soundEnabled) {
            this.sounds.background.pause();
            this.sounds.gameover();
        }
        
        // Save score
        this.saveScore();
        
        // Show game over screen
        const gameOverScreen = document.querySelector('.game-over');
        gameOverScreen.style.display = 'block';
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalCombo').textContent = `x${this.combo}`;
        document.getElementById('coinsEarned').textContent = this.coinsEarned;
        
        // Update leaderboard
        this.updateLeaderboard();
        
        // Notify server
        this.sendMessage({ type: 'end' });
        
        this.savePlayerData();
    }
    
    generateTransactionId() {
        // Generate a unique transaction ID using timestamp and random string
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9);
        return `tx_${timestamp}_${randomStr}`;
    }
    
    saveScore() {
        const transactionId = this.generateTransactionId();
        const scoreData = {
            transactionId: transactionId,
            playerName: this.playerName || 'Anonymous',
            score: this.score,
            combo: this.combo,
            coinsEarned: this.coinsEarned,
            date: new Date().toISOString(),
            verified: false
        };
        
        // Save to local storage with transaction ID
        this.savedScores.push(scoreData);
        this.savedScores.sort((a, b) => b.score - a.score);
        this.savedScores = this.savedScores.slice(0, 10);
        localStorage.setItem('pixelPopScores', JSON.stringify(this.savedScores));
        
        // Send score to server with transaction ID
        this.sendMessage({
            type: 'score',
            playerId: this.playerId,
            score: this.score,
            transactionId: transactionId,
            data: scoreData
        });
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    updateLeaderboard() {
        const leaderboardList = document.querySelector('.leaderboard-list');
        leaderboardList.innerHTML = '';
        
        // Combine local and multiplayer scores
        const allScores = [...this.savedScores];
        this.players.forEach(player => {
            if (player.score > 0) {
                allScores.push({
                    transactionId: player.transactionId || 'pending',
                    playerName: player.name,
                    score: player.score,
                    date: new Date().toISOString(),
                    verified: player.verified || false
                });
            }
        });
        
        // Sort and display top scores
        allScores.sort((a, b) => b.score - a.score)
            .slice(0, 10)
            .forEach((score, index) => {
                const entry = document.createElement('div');
                entry.className = 'leaderboard-entry';
                entry.innerHTML = `
                    <span class="rank">${index + 1}.</span>
                    <span class="name">${score.playerName}</span>
                    <span class="score">${score.score}</span>
                    <span class="transaction-id" title="Transaction ID">${score.transactionId}</span>
                    ${score.verified ? '<span class="verified">✓</span>' : '<span class="pending">⏳</span>'}
                `;
                leaderboardList.appendChild(entry);
            });
    }
    
    setupShop() {
        const shopItems = document.querySelectorAll('.shop-item');
        shopItems.forEach(item => {
            const buyButton = item.querySelector('.buy-button');
            const itemId = item.dataset.item;
            const cost = parseInt(item.dataset.cost);
            
            // Check if item is already purchased
            if (this.purchasedItems.includes(itemId)) {
                buyButton.textContent = 'Owned';
                buyButton.disabled = true;
            }
            
            buyButton.addEventListener('click', () => {
                if (this.coins >= cost && !this.purchasedItems.includes(itemId)) {
                    this.purchaseItem(itemId, cost);
                }
            });
        });
    }
    
    purchaseItem(itemId, cost) {
        if (this.coins >= cost) {
            this.coins -= cost;
            this.purchasedItems.push(itemId);
            
            // Save to localStorage
            localStorage.setItem('pixelPopCoins', this.coins.toString());
            localStorage.setItem('pixelPopPurchasedItems', JSON.stringify(this.purchasedItems));
            
            // Update UI
            this.updateWalletDisplay();
            this.applyItemEffect(itemId);
            
            // Update shop button
            const itemElement = document.querySelector(`[data-item="${itemId}"]`);
            const buyButton = itemElement.querySelector('.buy-button');
            buyButton.textContent = 'Owned';
            buyButton.disabled = true;
        }
    }
    
    applyItemEffect(itemId) {
        switch(itemId) {
            case 'theme1':
                // Apply neon theme
                document.body.style.background = 'linear-gradient(135deg, #1a1a1a, #2a2a2a)';
                break;
            case 'theme2':
                // Apply retro theme
                document.body.style.background = 'linear-gradient(135deg, #2c3e50, #3498db)';
                break;
            case 'powerup1':
                // Add time boost
                this.timeLeft += 10;
                document.getElementById('time').textContent = Math.ceil(this.timeLeft);
                break;
        }
    }
    
    updateWalletDisplay() {
        document.getElementById('walletBalance').textContent = this.coins;
    }
    
    earnCoins(amount) {
        this.coins += amount;
        this.coinsEarned += amount;
        localStorage.setItem('pixelPopCoins', this.coins.toString());
        this.updateWalletDisplay();
    }
    
    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(deltaTime);
        this.draw();
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    setupFrontPage() {
        // Handle user name input
        this.userNameInput.addEventListener('input', () => {
            this.userName = this.userNameInput.value.trim();
            this.updateStartButton();
        });
        
        // Handle wallet address input
        this.walletAddressInput.addEventListener('input', () => {
            this.updateStartButton();
        });
        
        // Handle wallet connection
        this.connectWalletButton.addEventListener('click', () => {
            this.connectWallet();
        });
        
        // Handle start game button
        this.startGameButton.addEventListener('click', () => {
            if (this.userName && this.walletConnected) {
                this.showGamePage();
            }
        });
    }
    
    connectWallet() {
        const address = this.walletAddressInput.value.trim();
        
        // Basic Ethereum address validation
        if (!this.isValidEthereumAddress(address)) {
            this.walletStatus.textContent = 'Invalid wallet address';
            this.walletStatus.classList.remove('connected');
            return;
        }
        
        this.walletAddress = address;
        this.walletConnected = true;
        
        // Update UI
        this.walletStatus.textContent = 'Connected';
        this.walletStatus.classList.add('connected');
        this.connectWalletButton.textContent = 'Wallet Connected';
        this.connectWalletButton.disabled = true;
        this.walletAddressInput.disabled = true;
        
        // Display wallet address
        this.walletAddress.style.display = 'block';
        this.addressDisplay.textContent = this.formatAddress(this.walletAddress);
        
        this.updateStartButton();
    }
    
    isValidEthereumAddress(address) {
        // Basic Ethereum address validation
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    
    handleDisconnect() {
        this.walletConnected = false;
        this.walletAddress = '';
        this.walletStatus.textContent = 'Not Connected';
        this.walletStatus.classList.remove('connected');
        this.connectWalletButton.textContent = 'Connect Wallet';
        this.connectWalletButton.disabled = false;
        this.walletAddressInput.disabled = false;
        this.walletAddress.style.display = 'none';
        this.updateStartButton();
    }
    
    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
    
    updateStartButton() {
        const hasValidAddress = this.isValidEthereumAddress(this.walletAddressInput.value.trim());
        this.startGameButton.disabled = !(this.userName && hasValidAddress);
    }
    
    showGamePage() {
        this.frontPage.style.display = 'none';
        this.gameContainer.style.display = 'block';
        
        // Initialize game with user name
        this.playerName = this.userName;
        this.setupPlayerName();
        
        // Start game initialization
        this.setupResponsiveCanvas();
        this.setupSounds();
        this.setupControls();
        this.connectToServer();
        this.gameLoop();
    }
    
    setupRoomControls() {
        const createRoomBtn = document.getElementById('createRoom');
        const joinRoomBtn = document.getElementById('joinRoom');
        const roomCodeInput = document.getElementById('roomCode');
        
        createRoomBtn.addEventListener('click', () => {
            this.createRoom();
        });
        
        joinRoomBtn.addEventListener('click', () => {
            const code = roomCodeInput.value.trim();
            if (code) {
                this.joinRoom(code);
            }
        });
    }
    
    createRoom() {
        // Generate a random 4-digit room code
        this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();
        this.roomId = this.roomCode;
        this.isHost = true;
        
        // Update UI
        document.getElementById('currentRoom').textContent = this.roomCode;
        document.getElementById('createRoom').disabled = true;
        document.getElementById('joinRoom').disabled = true;
        document.getElementById('roomCode').disabled = true;
        
        // Connect to server with room code
        this.connectToServer();
    }
    
    joinRoom(code) {
        this.roomCode = code;
        this.roomId = code;
        this.isHost = false;
        
        // Update UI
        document.getElementById('currentRoom').textContent = code;
        document.getElementById('createRoom').disabled = true;
        document.getElementById('joinRoom').disabled = true;
        document.getElementById('roomCode').disabled = true;
        
        // Connect to server with room code
        this.connectToServer();
    }

    async loadPlayerData() {
        if (this.walletAddress) {
            try {
                const response = await fetch(`/api/player/${this.walletAddress}`);
                if (response.ok) {
                    this.playerData = await response.json();
                    this.updatePlayerStats();
                }
            } catch (error) {
                console.error('Error loading player data:', error);
            }
        }
    }

    updatePlayerStats() {
        const statsContainer = document.getElementById('playerStats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <p>High Score: ${this.playerData.highScore}</p>
                <p>Total Coins: ${this.playerData.totalCoins}</p>
                <p>Games Played: ${this.playerData.gamesPlayed}</p>
            `;
        }
    }

    async savePlayerData() {
        if (!this.walletAddress) return;

        try {
            const response = await fetch('/api/player/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    score: this.score,
                    coins: Math.floor(this.score / 100) // 1 coin per 100 points
                })
            });

            if (response.ok) {
                this.playerData = await response.json();
                this.updatePlayerStats();
            }
        } catch (error) {
            console.error('Error saving player data:', error);
        }
    }

    setupWalletControls() {
        const walletInput = document.getElementById('walletAddress');
        const saveWalletButton = document.getElementById('saveWallet');
        const playerStats = document.getElementById('playerStats');

        if (walletInput && saveWalletButton) {
            walletInput.value = this.walletAddress;

            saveWalletButton.addEventListener('click', async () => {
                const newWalletAddress = walletInput.value.trim();
                if (newWalletAddress && newWalletAddress !== this.walletAddress) {
                    this.walletAddress = newWalletAddress;
                    localStorage.setItem('walletAddress', this.walletAddress);
                    await this.loadPlayerData();
                }
            });
        }
    }
}

// Initialize game when window loads
window.addEventListener('load', () => {
    window.game = new Game();
}); 