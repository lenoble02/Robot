
const express = require('express');
const path = require('path');
const WebSocket = require('ws');
const app = express();
const PORT = process.env.PORT || 3000;

// Récupération sécurisée du jeton API depuis les variables d'environnement Render
const BROKER_API_TOKEN = process.env.BROKER_API_TOKEN || '';

// Middleware pour lire les données JSON et les formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre le dossier courant accessible publiquement (pour vos fichiers HTML, app.js, images, sw.js)
app.use(express.static(path.join(__dirname)));

// --- CONFIGURATION WEBSOCKET COURTIER ---
// L'URL est optionnelle tant qu'aucun jeton n'est configuré (mode simulation propre)
const BROKER_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=1089'; 
let brokerWs = null;
let isBrokerConnected = false;

function connectToBroker() {
    // Si aucun token n'est configuré ou si l'URL est vide, on reste en mode simulation pure sans lancer de WebSocket
    if (!BROKER_API_TOKEN || !BROKER_WS_URL) {
        console.log('[BROKER] Aucun jeton API ou URL détecté. Fonctionnement en mode simulation propre.');
        return;
    }

    console.log('[BROKER] Connexion en cours vers le serveur du courtier avec le jeton sécurisé...');
    brokerWs = new WebSocket(BROKER_WS_URL);

    brokerWs.on('open', () => {
        isBrokerConnected = true;
        console.log('[BROKER] Connecté avec succès au courtier en temps réel !');
        
        // Envoi de l'authentification avec le jeton sécurisé de Render
        const authMessage = {
            authorize: BROKER_API_TOKEN
        };
        brokerWs.send(JSON.stringify(authMessage));
    });

    brokerWs.on('message', (data) => {
        try {
            const response = JSON.parse(data);
            console.log('[BROKER] Données reçues du marché :', response);
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

// Lancer la tentative de connexion au démarrage
connectToBroker();


// --- ROUTES DE VOTRE APPLICATION WEB ---

// Route par défaut (charge votre page principale)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- API DE TRADING ---

// 1. Récupérer les soldes (Démo / Réel)
app.get('/api/trading/solde', (req, res) => {
    res.json({
        solde_demo: 50043.15,
        solde_reel: 106.89,
        devise: "XOF"
    });
});

// 2. Recevoir un ordre de trade depuis votre interface web ou votre bot
app.post('/api/trading/executer', (req, res) => {
    const { actif, montant, type_option, type_compte } = req.body; 

    console.log(`[BOT TRADING] Compte: ${type_compte || 'DEMO'} | Actif: ${actif}, Montant: ${montant}, Type: ${type_option}`);

    // Si le jeton est présent, que le compte est Réel et que le WebSocket est connecté -> Vrai trade
    if (BROKER_API_TOKEN && isBrokerConnected && type_compte === 'REEL') {
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
            message: `Ordre réel transmis au marché en direct sur le compte ${type_compte} !`,
            id_trade: Date.now(),
            resultat: "Exécuté en direct"
        });
    }

    // Mode simulation par défaut (si aucun jeton ou si compte Démo)
    res.json({
        success: true,
        message: `Trade exécuté avec succès sur le compte ${type_compte || 'DEMO'} (Simulation)`,
        id_trade: Date.now(),
        resultat: "En attente..."
    });
});

// Lancement du serveur compatible Render (0.0.0.0)
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré avec succès sur http://${HOST}:${PORT}`);
});
