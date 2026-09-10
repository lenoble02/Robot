
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour lire les données JSON et les formulaires
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rendre le dossier courant accessible publiquement (pour vos fichiers HTML, app.js, images, sw.js)
app.use(express.static(path.join(__dirname)));

// --- ROUTES DE VOTRE APPLICATION WEB ---

// Route par défaut (charge votre page principale)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- EXEMPLE D'API DE TRADING (Simulation) ---
// C'est ici que votre futur robot ou interface viendra chercher ou envoyer des données

// 1. Récupérer les soldes (Démo / Réel)
app.get('/api/trading/solde', (req, res) => {
    // Données simulées (inspirées de votre interface Pocket Option)
    res.json({
        solde_demo: 50043.15,
        solde_reel: 106.89,
        devise: "XOF"
    });
});

// 2. Recevoir un ordre de trade depuis votre interface web ou votre bot (mis à jour pour inclure type_compte)
app.post('/api/trading/executer', (req, res) => {
    const { actif, montant, type_option, type_compte } = req.body; // ex: EUR/USD, 500, Call/Put, DEMO/REEL

    console.log(`[BOT TRADING] Compte: ${type_compte || 'DEMO'} | Actif: ${actif}, Montant: ${montant}, Type: ${type_option}`);

    // Ici, vous intégrerez plus tard la logique de votre robot (connexion API ou Selenium)

    // Simulation d'une réponse de succès
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
