
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

const binanceApiKey = process.env.BINANCE_API_KEY;
const binanceSecretKey = process.env.BINANCE_SECRET_KEY;

let soldeDemoCourant = 50043.15;
let miseStrategie = 5;
let directionStrategie = 'CALL'; // Direction par défaut du tout premier trade

const exchange = new ccxt.binance({
    apiKey: binanceApiKey ? binanceApiKey.trim() : '',
    secret: binanceSecretKey ? binanceSecretKey.trim() : '',
    options: { defaultType: 'spot' }
});

(async () => {
    try {
        await exchange.loadMarkets();
        console.log("Marchés Binance chargés avec succès.");
    } catch (e) {
        console.error("Erreur lors du chargement des marchés Binance :", e.message);
    }
})();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/trading/solde', async (req, res) => {
    try {
        let usdtFree = 0;
        if (binanceApiKey && binanceSecretKey) {
            const balance = await exchange.fetchBalance();
            usdtFree = balance.free['USDT'] || 0;
        }
        res.json({
            solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
            solde_reel: parseFloat(usdtFree.toFixed(2)),
            devise: "USDT"
        });
    } catch (error) {
        res.json({
            solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
            solde_reel: 0.00,
            devise: "USDT"
        });
    }
});

app.post('/api/trading/executer', async (req, res) => {
    const { actif, montant, type_option, type_compte, strategie_active, phase, resultat } = req.body;
    const cryptoChoisie = actif || 'BTC/USDT';

    // 1. PHASE DE DÉBUT : Le bot prend exactement les valeurs actuelles en mémoire
    if (phase === 'DEBUT') {
        let montantUtilise = parseFloat(montant) || 5;
        let optionUtilisee = type_option;

        if (strategie_active) {
            montantUtilise = miseStrategie;
            optionUtilisee = directionStrategie;
        }

        return res.json({
            success: true,
            montant_utilise: montantUtilise,
            type_option_utilise: optionUtilisee
        });
    }

    // 2. PHASE DE FIN : C'est ici qu'on évalue le résultat et qu'on met à jour pour le trade SUIVANT
    let miseActuelle = parseFloat(montant) || 5;

    if (strategie_active) {
        if (resultat === "Gain") {
            // GAIN : On redescend la mise à 5, et on GARDE EXACTEMENT LA MÊME DIRECTION (pas d'inversion)
            miseStrategie = 5;
            // directionStrategie NE CHANGE PAS (si on a gagné en PUT, on refait PUT)
        } else if (resultat === "Perdu") {
            // PERTE : On double la mise et on INVERSE la direction pour le prochain trade
            miseStrategie = miseActuelle * 2;
            directionStrategie = (directionStrategie === 'CALL') ? 'PUT' : 'CALL';
        }
    }

    let optionFinale = type_option;

    if (type_compte === 'REEL' && binanceApiKey) {
        try {
            const symbol = cryptoChoisie.replace(' OTC', '');
            const side = optionFinale === 'CALL' ? 'buy' : 'sell';
            const quantite = miseActuelle / 70000;

            await exchange.createOrder(symbol, 'market', side, quantite);

            return res.json({
                success: true,
                prochaine_mise: miseStrategie,
                prochaine_direction: directionStrategie
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    let gainFictif = 0;
    if (resultat === "Gain") {
        gainFictif = miseActuelle * 0.85;
        soldeDemoCourant += gainFictif;
    } else {
        soldeDemoCourant -= miseActuelle;
    }

    res.json({
        success: true,
        nouveau_solde_demo: parseFloat(soldeDemoCourant.toFixed(2)),
        prochaine_mise: miseStrategie,
        prochaine_direction: directionStrategie,
        resultat: resultat
    });
});

app.get('/api/trading/bougies', async (req, res) => {
    try {
        const symbol = req.query.symbol || 'BTC/USDT';
        let timeframe = req.query.timeframe || '1m';

        if (timeframe === '5s' || timeframe === '30s') {
            timeframe = '1m';
        }

        const ohlcv = await exchange.fetchOHLCV(symbol, timeframe, undefined, 50);

        res.json({
            success: true,
            bougies: ohlcv.map(b => ({ temps: b[0], cloture: b[4] }))
        });
    } catch (error) {
        res.status(500).json({ success: false, erreur: error.message });
    }
});

const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré avec succès sur http://${HOST}:${PORT}`);
});
