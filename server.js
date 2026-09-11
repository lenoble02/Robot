

const fs = require('fs');
if (fs.existsSync('.env')) {
    const envConfig = require('dotenv').parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const express = require('express');
const path = require('path');
const ccxt = require('ccxt');
const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION BINANCE VIA .ENV ---
const binanceApiKey = process.env.BINANCE_API_KEY;
const binanceSecretKey = process.env.BINANCE_SECRET_KEY;

// Variable globale pour stocker et faire varier le solde démo en mémoire
let soldeDemoCourant = 50043.15;

// Initialisation du client Binance pour le trading réel Spot
const exchange = new ccxt.binance({
    apiKey: binanceApiKey ? binanceApiKey.trim() : '',
    secret: binanceSecretKey ? binanceSecretKey.trim() : '',
    options: { defaultType: 'spot' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 1. Récupération des soldes (réel et démo dynamique)
app.get('/api/trading/solde', async (req, res) => {
    try {
        let usdtFree = 0;
        if (binanceApiKey && binanceSecretKey) {
            const balance = await exchange.fetchBalance();
            usdtFree = balance.free['USDT'] || 0;
            console.log('[BINANCE] Solde récupéré avec succès !');
        }

        res.json({
            solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
            solde_reel: usdtFree,
            devise: "USDT"
        });
    } catch (error) {
        console.error('[BINANCE] Erreur lors de la récupération des soldes :', error.message);

        res.json({
            solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
            solde_reel: 0.00,
            devise: "USDT",
            erreur: "Impossible de joindre Binance (Vérifiez les clés ou les restrictions)"
        });
    }
});

// 2. Exécution d'un ordre réel ou d'une simulation avec variation du solde démo
app.post('/api/trading/executer', async (req, res) => {
    const { actif, montant, type_option, type_compte } = req.body;
    const mise = parseFloat(montant) || 10;
    const cryptoChoisie = actif || 'BTC/USDT';

    console.log(`[BOT TRADING] Compte: ${type_compte || 'DEMO'} | Actif: ${cryptoChoisie}, Montant: ${mise}, Type: ${type_option}`);

    if (type_compte === 'REEL' && binanceApiKey) {
        try {
            let symbol = 'BTC/USDT';
            if (cryptoChoisie && cryptoChoisie.includes('/')) {
                symbol = cryptoChoisie.replace(' OTC', '');
            }

            const side = type_option === 'CALL' ? 'buy' : 'sell';
            const order = await exchange.createOrder(symbol, 'market', side, mise);
            console.log('[BINANCE] Ordre réel exécuté avec succès :', order);

            res.json({
                success: true,
                message: `Ordre ${side.toUpperCase()} de ${mise} exécuté avec succès sur Binance (${symbol}) !`,
                id_trade: order.id || Date.now(),
                resultat: "Exécuté sur Binance"
            });
        } catch (error) {
            console.error('[BINANCE] Erreur d\'exécution :', error.message);
            res.status(500).json({
                success: false,
                message: `Erreur Binance: ${error.message}`,
                resultat: "Échec d'exécution"
            });
        }
        return;
    }

    // --- MODE SIMULATION (Compte Démo dynamique sur la crypto choisie) ---
    const gainFictif = mise * 0.85;
    soldeDemoCourant += gainFictif;

    res.json({
        success: true,
        message: `Simulation réussie sur ${cryptoChoisie} (DEMO). Gain fictif : +${gainFictif.toFixed(2)} USDT`,
        id_trade: Date.now(),
        nouveau_solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
        resultat: "Victoire simulée"
    });
});

// Route pour récupérer l'historique des bougies d'une cryptomonnaie sur Binance
app.get('/api/trading/bougies', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'BTC/USDT';
        const timeframe = req.query.timeframe || '1m';

        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 50);

        res.json({
            success: true,
            symbol: symbol,
            bougies: ohlcv.map(b => ({
                temps: b[0],
                ouverture: b[1],
                haut: b[2],
                bas: b[3],
                cloture: b[4],
                volume: b[5]
            }))
        });
    } catch (error) {
        console.error('[BINANCE] Erreur bougies :', error.message);
        res.status(500).json({ success: false, erreur: error.message });
    }
});

// Route pour récupérer le carnet d'ordres (Order Book) en temps réel
app.get('/api/trading/orderbook', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'BTC/USDT';
        const orderbook = await exchange.fetchOrderBook(symbol, 10); // 10 meilleurs prix achat/vente

        res.json({
            success: true,
            symbol: symbol,
            bids: orderbook.bids, // Ordres d'achat (vert)
            asks: orderbook.asks  // Ordres de vente (rouge)
        });
    } catch (error) {
        console.error('[BINANCE] Erreur orderbook :', error.message);
        res.status(500).json({ success: false, erreur: error.message });
    }
});



// Lancement du serveur
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré avec succès sur http://${HOST}:${PORT}`);
});
