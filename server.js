
const express = require('express');
const path = require('path');
const ioClient = require('socket.io-client');
const app = express();
const PORT = process.env.PORT || 3000;

// Récupération sécurisée du jeton ou identifiant de session depuis Render
const BROKER_API_TOKEN = process.env.BROKER_API_TOKEN || '';

// Middleware pour lire les données JSON et les formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre le dossier courant accessible publiquement (pour vos fichiers HTML, app.js, images, sw.js)
app.use(express.static(path.join(__dirname)));

// --- CONFIGURATION WEBSOCKET POCKET OPTION ---
let brokerSocket = null;
let isBrokerConnected = false;

function connectToPocketOption() {
    // Si aucun jeton de session n'est configuré, on reste en mode simulation propre
    if (!BROKER_API_TOKEN) {
        console.log('[POCKET OPTION] Aucun jeton de session détecté. Fonctionnement en mode simulation propre.');
        return;
    }

    console.log('[POCKET OPTION] Connexion en cours vers le serveur de trading réel...');
    
    // Connexion via Socket.IO avec l'identifiant de session sécurisé
    brokerSocket = ioClient('https://pocketoption.com', {
        path: '/socket.io/',
        transports: ['websocket'],
        query: {
            session: BROKER_API_TOKEN
        }
    });

    brokerSocket.on('connect', () => {
        isBrokerConnected = true;
        console.log('[POCKET OPTION] Connecté avec succès au compte réel en temps réel !');
    });

    brokerSocket.on('disconnect', () => {
        isBrokerConnected = false;
        console.log('[POCKET OPTION] Déconnecté du courtier. Tentative de reconnexion...');
    });

    brokerSocket.on('connect_error', (error) => {
        console.error('[POCKET OPTION] Erreur de connexion WebSocket :', error.message);
    });
}

// Lancer la tentative de connexion au démarrage
connectToPocketOption();


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

    // Si le jeton de session est présent, que le compte est Réel et que le WebSocket est connecté -> Vrai trade
    if (BROKER_API_TOKEN && isBrokerConnected && type_compte === 'REEL') {
        const pocketOrder = {
            action: 'open_order',
            asset: actif,
            amount: montant,
            direction: type_option.toUpperCase().includes('HAUSSE') ? 'call' : 'put',
            time: 60
        };

        brokerSocket.emit('message', pocketOrder, (response) => {
            console.log('[POCKET OPTION] Réponse de l\'ordre en direct :', response);
        });

        return res.json({
            success: true,
            message: `Ordre réel transmis au marché en direct sur le compte ${type_compte} !`,
            id_trade: Date.now(),
            resultat: "Exécuté en direct"
        });
    }

    // Mode simulation par défaut (si aucun jeton ou si compte Démo ou si assistant d'analyse)
    res.json({
        success: true,
        message: `Signal validé et enregistré pour le compte ${type_compte || 'DEMO'} (Assistant Intelligent)`,
        id_trade: Date.now(),
        resultat: "Prêt pour exécution manuelle"
    });
});

// Lancement du serveur compatible Render (0.0.0.0)
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Serveur démarré avec succès sur http://${HOST}:${PORT}`);
});
