# 🚇 Site de Fête d'Anniversaire - Thème Métro Parisien

Un site web interactif permettant aux invités de sélectionner anonymement une station de métro parisienne pour une fête d'anniversaire thématique.

## 🎯 Fonctionnalités

- **Sélection unique par IP** : Chaque adresse IP ne peut sélectionner qu'une seule station
- **Anonymat garanti** : Personne ne peut voir qui a pris quelle station
- **Temps réel** : Les sélections sont mises à jour instantanément pour tous les utilisateurs
- **Interface moderne** : Design responsive avec animations fluides
- **Recherche** : Fonction de recherche pour trouver rapidement une station
- **Protection anti-spam** : Rate limiting par IP
- **WebSocket** : Mises à jour en temps réel sans rechargement

## 📁 Architecture du Projet

```
metro-birthday-party/
├── package.json              # Configuration npm et dépendances
├── server.js                 # Serveur Node.js principal
├── public/
│   └── index.html            # Interface utilisateur
├── README.md                 # Ce fichier
└── .gitignore               # Fichiers à ignorer par Git
```

## 🚀 Installation

### Prérequis
- Node.js (version 14 ou supérieure)
- npm (inclus avec Node.js)

### Étapes d'installation

1. **Cloner ou créer le dossier du projet**
```bash
mkdir metro-birthday-party
cd metro-birthday-party
```

2. **Créer les fichiers**
Copiez le contenu des artifacts dans les fichiers correspondants :
- `package.json`
- `server.js`
- Créer le dossier `public/` et y placer `index.html`

3. **Installer les dépendances**
```bash
npm install
```

4. **Démarrer le serveur**
```bash
# Mode production
npm start

# Mode développement (avec auto-restart)
npm run dev
```

5. **Ouvrir le navigateur**
Allez sur `http://localhost:3000`

## 🎮 Utilisation

### Pour les invités
1. Ouvrir le site web
2. Parcourir ou rechercher une station de métro
3. Cliquer sur une station disponible (verte) pour la sélectionner
4. Une fois sélectionnée, la station devient bleue pour vous et grise pour les autres

### Pour l'organisateur
Le serveur affiche des logs dans la console pour suivre les connexions et sélections.

#### Commandes admin (via API)
```bash
# Libérer une station spécifique
curl -X POST http://localhost:3000/api/release \
  -H "Content-Type: application/json" \
  -d '{"station": "Châtelet", "adminKey": "reset123"}'

# Reset toutes les sélections
curl -X POST http://localhost:3000/api/reset-all \
  -H "Content-Type: application/json" \
  -d '{"adminKey": "reset123"}'
```

**⚠️ Important** : Changez la clé admin `reset123` dans le code avant utilisation !

## 🔧 Configuration

### Variables d'environnement
```bash
PORT=3000  # Port du serveur (optionnel, défaut: 3000)
```

### Personnalisation

#### Modifier les stations
Dans `server.js`, modifiez le tableau `metroStations` pour ajouter/retirer des stations :

```javascript
const metroStations = [
  'Votre Station 1',
  'Votre Station 2',
  // ... ajoutez vos stations
];
```

#### Changer la clé admin
Dans `server.js`, remplacez `reset123` par votre clé :

```javascript
if (adminKey !== 'VOTRE_CLE_SECURISEE') {
```

#### Modifier le design
Éditez les styles CSS dans `public/index.html` pour personnaliser l'apparence.

## 🌐 Déploiement

### Déploiement local sur réseau
1. Trouvez votre adresse IP locale :
```bash
# Windows
ipconfig

# Mac/Linux  
ifconfig
```

2. Démarrez le serveur et donnez l'adresse IP aux invités :
`http://VOTRE_IP:3000`

### Déploiement en ligne

#### Heroku
```bash
# Installer Heroku CLI puis :
heroku create votre-app-name
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a votre-app-name
git push heroku main
```

#### Autres plateformes
- **Vercel** : Compatible avec les applications Node.js
- **Railway** : Simple déploiement depuis GitHub
- **DigitalOcean App Platform** : Pour plus de contrôle

## 🔒 Sécurité

### Mesures implémentées
- **Helmet.js** : Protection contre les vulnérabilités courantes
- **Rate limiting** : 1 sélection par IP par 24h
- **CORS** : Configuration des origines autorisées
- **Validation des entrées** : Vérification des données côté serveur

### Recommandations
1. Changez la clé admin par défaut
2. Utilisez HTTPS en production
3. Configurez un reverse proxy (nginx) si nécessaire
4. Limitez l'accès aux routes admin par IP si possible

## 🐛 Résolution de problèmes

### Le site ne se charge pas
- Vérifiez que Node.js est installé : `node --version`
- Vérifiez que le port 3000 n'est pas utilisé
- Consultez les logs du serveur

### Les sélections ne se synchronisent pas
- Vérifiez la connexion WebSocket dans les outils développeur
- Redémarrez le serveur
- Vérifiez la configuration du pare-feu

### Erreur "Station déjà prise"
- Normal : quelqu'un d'autre a sélectionné la station en même temps
- Les mises à jour peuvent prendre quelques secondes

## 📊 Monitoring

### Logs serveur
Le serveur affiche :
- Connexions/déconnexions WebSocket
- Tentatives de réservation
- Erreurs de rate limiting

### Statistiques disponibles
- Nombre de stations disponibles/prises
- Total des stations
- Recherche en temps réel

## 🔁 Comportement des resets et libérations

- Lors d'un "reset global" (`POST /api/reset-all`), le serveur réinitialise maintenant le système de rate limiting en mémoire. Cela supprime toutes les entrées qui empêchaient une IP d'effectuer une nouvelle réservation. Après un reset global, les invités peuvent réserver à nouveau normalement.

- Lorsqu'une station est libérée via l'API `POST /api/release`, le serveur supprime également la clé du rate limiter associée à l'IP qui avait réservé cette station. Cela permet à cette IP de choisir une autre station immédiatement après la libération.

Ces changements rendent l'administration plus pratique pour les tests et la gestion manuelle des réservations. En production, pensez à utiliser une stratégie de rate limiting persistante (Redis, etc.) si vous avez besoin de conserver l'état entre redémarrages.

## 🎨 Personnalisation Avancée

### Ajouter des thèmes
Modifiez les variables CSS pour changer les couleurs :

```css
:root {
  --primary-color: #1e3c72;
  --secondary-color: #2a5298;
  --accent-color: #4CAF50;
}
```

### Ajouter des animations
Les animations CSS sont déjà intégrées, mais vous pouvez en ajouter d'autres dans les styles.

### Notifications personnalisées
Modifiez la méthode `showNotification()` dans le JavaScript pour changer les messages.

## 📝 Licence

Projet libre d'utilisation pour des événements personnels. Modifiez selon vos besoins !

## 🤝 Support

Pour des questions ou améliorations, consultez les logs serveur ou modifiez le code selon vos besoins spécifiques.

---

**Amusez-vous bien à votre fête thématique métro ! 🎉🚇**