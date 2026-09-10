
const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire les données JSON et les formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre le dossier courant accessible publiquement (pour vos fichiers HTML, app.js, images, sw.js)
app.use(express.static(path.join(__dirname)));

// --- CONFIGURATION WEBSOCKET COURTIER (EXEMPLE DERIV) ---
// Remplacez l'App ID par le vôtre ou utilisez l'ID public de test (1089)
const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089';
let brokerWs = null;
let isBrokerConnected = false;

function connectToBroker() {
    console.log('[BROKER] Connexion en cours vers le serveur du courtier...');
    brokerWs = new WebSocket(DERIV_WS_URL);

    brokerWs.on('open', () => {
        isBrokerConnected = true;
        console.log('[BROKER] Connecté avec succès au courtier en temps réel !');
        
        // Optionnel : Authentifiez-vous ici si vous avez un token API
        // sendAuthToken("VOTRE_API_TOKEN");
    });

    brokerWs.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            console.log('[BROKER] Données reçues du marché :', response);
            // Traitez ici les réponses aux ordres ou les flux de prix en direct
        } catch (e) {
            console.error('[BROKER] Erreur de parsing JSON :', e);
        }
    });

    brokerWs.on('close', () => {
        isBrokerConnected = false;
        console.log('[BROKER] Déconnecté du courtier. Tentative de reconnexion dans 5 secondes...');
        setTimeout(connectToBroker, 5000);
    });

    brokerWs.on('error', (error) => {
        console.error('[BROKER] Erreur WebSocket :', error.message);
    });
}

// Lancer la connexion au courtier au démarrage du serveur
connectToBroker();


// --- ROUTES DE VOTRE APPLICATION WEB ---

// Route par défaut (charge votre page principale)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API DE TRADING ---

// 1. Récupérer les soldes (Démo / Réel)
app.get('/api/trading/solde', (req, res) => {
    // Données simulées ou reliées dynamiquement aux données du courtier
    res.json({
        solde_demo: 50043.15,
        solde_reel: 106.89,
        devise: "XOF"
    });
});

// 2. Recevoir un ordre de trade depuis votre interface web ou votre bot
app.post('/api/trading/executer', (req, res) => {
    const { actif, montant, type_option, type_compte } = req.body; // ex: EUR/USD, 500, Call/Put, DEMO/REEL

    console.log(`[BOT TRADING] Compte: ${type_compte || 'DEMO'} | Actif: ${actif}, Montant: ${montant}, Type: ${type_option}`);

    // Vérifier si le courtier est connecté en temps réel pour basculer du mode simulation au mode réel
    if (isBrokerConnected && type_compte === 'REEL') {
        // Construire la requête d'ordre réelle pour l'envoyer via le WebSocket du broker
        const realOrder = {
            buy: 1,
            price: montant,
            parameters: {
                amount: montant,
                basis: 'stake',
                symbol: actif,
                duration: 1,
                duration_unit: 'm',
                contract_type: type_option.toUpperCase().includes('HAUSSE') ? 'CALL' : 'PUT'
            }
        };

        brokerWs.send(JSON.stringify(realOrder));

        return res.json({
            success: true,
            message: `Ordre réel transmis au marché avec succès sur le compte ${type_compte} !`,
            id_trade: Date.now(),
            resultat: "Exécuté en direct"
        });
    }

    // Mode simulation par défaut (ou si le compte est Démo)
    res.json({
        success: true,
        message: `Trade exécuté avec succès sur le compte ${type_compte || 'DEMO'} (Simulation)`,
        id_trade: Date.now(),
        resultat: "En attente..."
    });
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré avec succès ! Ouvrez http://localhost:${PORT} dans votre navigateur.`);
});
