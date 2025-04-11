const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

// Player data storage
const playerDataFile = 'playerData.json';
let playerData = {};

// Load existing player data
try {
    if (fs.existsSync(playerDataFile)) {
        playerData = JSON.parse(fs.readFileSync(playerDataFile, 'utf8'));
    }
} catch (err) {
    console.error('Error loading player data:', err);
}

// Save player data to file
function savePlayerData() {
    fs.writeFileSync(playerDataFile, JSON.stringify(playerData, null, 2));
}

// Middleware to parse JSON
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoints
app.post('/api/player/update', (req, res) => {
    const { walletAddress, score, coins } = req.body;
    
    if (!walletAddress) {
        return res.status(400).json({ error: 'Wallet address is required' });
    }

    if (!playerData[walletAddress]) {
        playerData[walletAddress] = {
            highScore: 0,
            totalCoins: 0,
            gamesPlayed: 0,
            lastPlayed: new Date().toISOString()
        };
    }

    // Update player data
    playerData[walletAddress].highScore = Math.max(playerData[walletAddress].highScore, score);
    playerData[walletAddress].totalCoins += coins;
    playerData[walletAddress].gamesPlayed += 1;
    playerData[walletAddress].lastPlayed = new Date().toISOString();

    // Save to file
    savePlayerData();

    res.json(playerData[walletAddress]);
});

app.get('/api/player/:walletAddress', (req, res) => {
    const { walletAddress } = req.params;
    
    if (!playerData[walletAddress]) {
        return res.status(404).json({ error: 'Player not found' });
    }

    res.json(playerData[walletAddress]);
});

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}); 