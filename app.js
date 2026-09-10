

// app.js - Fichier unique pour la PWA et les interactions de trading
// Initialisation de la Telegram Mini App
const tg = window.Telegram.WebApp;

// Indiquer à Telegram que l'application est prête et ouverte
tg.ready();

// Étendre l'application en plein écran sur mobile
tg.expand();

// Récupérer les informations de l'utilisateur Telegram (optionnel)
const utilisateurTelegram = tg.initDataUnsafe?.user;
if (utilisateurTelegram) {
    console.log("Utilisateur connecte :", utilisateurTelegram.first_name);
}


// 1. Enregistrement automatique du Service Worker (Mode hors ligne)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log("Service Worker enregistré avec succès, scope : ", reg.scope);
            })
            .catch(err => {
                console.error("Échec de l'enregistrement du Service Worker : ", err);
            });
    });
}

// 2. Fonctions pour interagir avec le serveur Node.js (API Trading)

// Récupérer les soldes (Démo et Réel) et les afficher dans l'interface
function chargerSoldes() {
    fetch('/api/trading/solde')
        .then(res => res.json())
        .then(data => {
            console.log("Soldes reçus :", data);

            // Mise à jour des éléments dans index.html
            const elDemo = document.getElementById('solde-demo');
            const elReel = document.getElementById('solde-reel');

            if (elDemo) {
                elDemo.textContent = `${data.solde_demo.toLocaleString()} ${data.devise}`;
            }
            if (elReel) {
                elReel.textContent = `${data.solde_reel.toLocaleString()} ${data.devise}`;
            }
        })
        .catch(err => console.error("Erreur lors du chargement des soldes :", err));
}

// Envoyer un ordre de trade au serveur (mis à jour pour inclure le type de compte)
function executerTrade(actif, montant, typeOption, typeCompte) {
    fetch('/api/trading/executer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            actif: actif,
            montant: montant,
            type_option: typeOption,
            type_compte: typeCompte
        })
    })
    .then(res => res.json())
    .then(resultat => {
        console.log("Réponse du robot :", resultat);
        alert(resultat.message);
        // Recharger les soldes après l'exécution du trade pour voir les mises à jour éventuelles
        chargerSoldes();
    })
    .catch(err => console.error("Erreur lors de l'exécution du trade :", err));
}

// Charger les données dès que la page est ouverte
window.addEventListener('DOMContentLoaded', () => {
    chargerSoldes();
});
