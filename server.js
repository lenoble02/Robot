
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

// 1. Récupération des soldes réels depuis Binance
app.get('/api/trading/solde', async (req, res) => {
    try {
        if (!binanceApiKey || !binanceSecretKey) {
            throw new Error("Clés API Binance non configurées dans le fichier .env");
        }

        const balance = await exchange.fetchBalance();
        const usdtFree = balance.free['USDT'] || 0;

        console.log('[BINANCE] Solde récupéré avec succès !');

        res.json({
            solde_demo: 50043.15,
            solde_reel: usdtFree,
            devise: "USDT"
        });
    } catch (error) {
        console.error('[BINANCE] Erreur lors de la récupération des soldes :', error.message);

        res.json({
            solde_demo: 50043.15,
            solde_reel: 0.00,
            devise: "USDT",
            erreur: "Impossible de joindre Binance (Vérifiez les clés ou les restrictions)"
        });
    }
});

// 2. Exécution d'un ordre réel ou d'une simulation
app.post('/api/trading/executer', async (req, res) => {
    const { actif, montant, type_option, type_compte } = req.body;

    console.log(`[BOT TRADING] Compte: ${type_compte || 'DEMO'} | Actif: ${actif}, Montant: ${montant}, Type: ${type_option}`);

    if (type_compte === 'REEL' && binanceApiKey) {
        try {
            let symbol = 'XLM/USDT';
            if (actif && actif.includes('/')) {
                symbol = actif.replace(' OTC', '');
            }

            const side = type_option === 'CALL' ? 'buy' : 'sell';
            const quantity = parseFloat(montant) || 10;

            const order = await exchange.createOrder(symbol, 'market', side, quantity);
            console.log('[BINANCE] Ordre réel exécuté avec succès :', order);

            res.json({
                success: true,
                message: `Ordre ${side.toUpperCase()} de ${quantity} exécuté avec succès sur Binance (${symbol}) !`,
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

    // Mode simulation par défaut (Compte Démo)
    res.json({
        success: true,
        message: `Signal validé et enregistré pour le compte ${type_compte || 'DEMO'} (Assistant Intelligent)`,
        id_trade: Date.now(),
        resultat: "Prêt pour exécution manuelle"
    });
});

// Lancement du serveur
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré avec succès sur http://${HOST}:${PORT}`);
});
