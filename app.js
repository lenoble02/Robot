
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

// Envoyer un ordre de trade au serveur (mis à jour pour inclure le type de compte et l'affichage dans le tableau)
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

        // Ajout dynamique de la ligne dans le tableau HTML de l'historique
        const tbody = document.getElementById('historique-table-body');
        if (tbody) {
            const newRow = document.createElement('tr');
            const colorStyle = typeOption === 'CALL' ? 'color: #4ade80;' : 'color: #f87171;';
            newRow.innerHTML = `
                <td style="padding: 8px;">${actif}</td>
                <td style="padding: 8px; ${colorStyle}">${typeOption}</td>
                <td style="padding: 8px;">${montant} XOF</td>
                <td style="padding: 8px;">${resultat.resultat || "Prêt pour exécution manuelle"}</td>
            `;
            tbody.prepend(newRow);
        }

        // Recharger les soldes après l'exécution du trade pour voir les mises à jour éventuelles
        chargerSoldes();
    })
    .catch(err => console.error("Erreur lors de l'exécution du trade :", err));
}

// Charger les données dès que la page est ouverte
window.addEventListener('DOMContentLoaded', () => {
    chargerSoldes();
});

// 3. Gestion de l'export JSON et du nettoyage de l'historique

// Exporter l'historique au format JSON
document.getElementById('btn-export')?.addEventListener('click', () => {
    const rows = document.querySelectorAll('#historique-table-body tr');
    const data = [];
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td');
        if (cols.length >= 4) {
            data.push({
                actif: cols[0].textContent,
                type: cols[1].textContent,
                montant: cols[2].textContent,
                statut: cols[3].textContent
            });
        }
    });

    if (data.length === 0) {
        alert("Aucun historique à exporter !");
        return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historique_trading_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// Effacer l'historique affiché
document.getElementById('btn-clear')?.addEventListener('click', () => {
    const tbody = document.getElementById('historique-table-body');
    if (tbody) {
        tbody.innerHTML = '';
    }
});
