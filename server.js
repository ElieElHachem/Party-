const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Sécurité et middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting par IP
const rateLimiter = new RateLimiterMemory({
  points: 1, // 1 sélection par IP
  duration: 86400, // Reset après 24h
});

// Stockage en mémoire des stations et des IPs
let reservedStations = new Map(); // station -> IP
let ipReservations = new Map(); // IP -> station

// Liste des stations de métro parisiennes (sélection représentative)
const metroStations = [
  // Ligne 1
  'Château de Vincennes', 'Bérault', 'Saint-Mandé', 'Nation', 'Reuilly - Diderot',
  'Gare de Lyon', 'Châtelet', 'Louvre - Rivoli', 'Palais-Royal - Musée du Louvre',
  'Tuileries', 'Concorde', 'Champs-Élysées - Clemenceau', 'George V', 'Charles de Gaulle - Étoile',
  'Argentine', 'Porte Maillot', 'Les Sablons', 'Pont de Neuilly', 'Esplanade de La Défense',
  'La Défense',
  
  // Ligne 4
  'Porte de Clignancourt', 'Simplon', 'Marcadet - Poissonniers', 'Château Rouge',
  'Barbès - Rochechouart', 'Gare du Nord', 'Gare de l\'Est', 'République', 'Hôtel de Ville',
  'Cité', 'Saint-Michel', 'Odéon', 'Saint-Germain-des-Prés', 'Saint-Sulpice',
  'Saint-Placide', 'Montparnasse - Bienvenüe', 'Vavin', 'Raspail', 'Denfert-Rochereau',
  'Mouton-Duvernet', 'Alésia', 'Porte d\'Orléans',
  
  // Ligne 6
  'Charles de Gaulle - Étoile', 'Kléber', 'Boissière', 'Trocadéro', 'Passy', 'Bir-Hakeim',
  'Dupleix', 'La Motte-Picquet - Grenelle', 'Cambronne', 'Sèvres - Lecourbe',
  'Pasteur', 'Montparnasse - Bienvenüe', 'Edgar Quinet', 'Raspail', 'Denfert-Rochereau',
  'Saint-Jacques', 'Glacière', 'Corvisart', 'Place d\'Italie', 'Nationale', 'Chevaleret',
  'Quai de la Gare', 'Bercy', 'Dugommier', 'Daumesnil', 'Bel-Air', 'Picpus', 'Nation',
  
  // Ligne 9
  'Pont de Sèvres', 'Billancourt', 'Marcel Sembat', 'Pont de Sèvres', 'Exelmans',
  'Michel-Ange - Molitor', 'Michel-Ange - Auteuil', 'Jasmin', 'Ranelagh', 'La Muette',
  'Rue de la Pompe', 'Trocadéro', 'Iéna', 'Alma - Marceau', 'Franklin D. Roosevelt',
  'Chaussée d\'Antin - La Fayette', 'Richelieu - Drouot', 'Grands Boulevards',
  'Bonne Nouvelle', 'Strasbourg - Saint-Denis', 'République', 'Oberkampf',
  'Saint-Ambroise', 'Voltaire', 'Charonne', 'Rue des Boulets', 'Nation',
  'Buzenval', 'Maraîchers', 'Porte de Montreuil', 'Robespierre', 'Croix de Chavaux',
  'Mairie de Montreuil',
  
  // Ligne 14
  'Saint-Lazare', 'Châtelet', 'Gare de Lyon', 'Bercy', 'Cour Saint-Émilion',
  'Bibliothèque François Mitterrand', 'Olympiades',
  
  // Stations emblématiques d'autres lignes
  'Pigalle', 'Abbesses', 'Anvers', 'Opéra', 'Bastille', 'Père Lachaise',
  'Belleville', 'Ménilmontant', 'Invalides', 'École Militaire', 'Pont Neuf',
  'Châtelet - Les Halles', 'Réaumur - Sébastopol', 'Arts et Métiers',
  'Temple', 'Filles du Calvaire', 'Saint-Paul', 'Pont Marie', 'Sully - Morland',
  'Mabillon', 'Cluny - La Sorbonne', 'Maubert - Mutualité', 'Cardinal Lemoine',
  'Jussieu', 'Place Monge', 'Censier - Daubenton', 'Les Gobelins',
  'Place d\'Italie', 'Tolbiac', 'Maison Blanche', 'Porte d\'Italie'
];

// Fonction pour obtenir l'IP réelle du client
function getRealIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         req.ip;
}

// Routes API
app.get('/api/stations', (req, res) => {
  const stationsStatus = metroStations.map(station => ({
    name: station,
    reserved: reservedStations.has(station)
  }));
  res.json(stationsStatus);
});

app.post('/api/reserve', async (req, res) => {
  const { station } = req.body;
  const clientIP = getRealIP(req);
  
  try {
    // Vérifier le rate limiting
    await rateLimiter.consume(clientIP);
    
    // Vérifier si la station existe
    if (!metroStations.includes(station)) {
      return res.status(400).json({ error: 'Station invalide' });
    }
    
    // Vérifier si l'IP a déjà réservé une station
    if (ipReservations.has(clientIP)) {
      return res.status(400).json({ error: 'Vous avez déjà sélectionné une station' });
    }
    
    // Vérifier si la station est déjà réservée
    if (reservedStations.has(station)) {
      return res.status(400).json({ error: 'Station déjà prise' });
    }
    
    // Réserver la station
    reservedStations.set(station, clientIP);
    ipReservations.set(clientIP, station);
    
    // Notifier tous les clients connectés
    io.emit('stationReserved', { station });
    
    res.json({ success: true, station });
    
  } catch (rejRes) {
    res.status(429).json({ error: 'Vous avez déjà fait votre sélection' });
  }
});

// Route pour libérer une réservation (admin uniquement - pour les tests)
app.post('/api/release', (req, res) => {
  const { station, adminKey } = req.body;
  
  // Clé admin simple (à changer en production)
  if (adminKey !== 'reset123') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  
  if (reservedStations.has(station)) {
    const ip = reservedStations.get(station);
    reservedStations.delete(station);
    ipReservations.delete(ip);
    
    io.emit('stationReleased', { station });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Station non réservée' });
  }
});

// Route pour reset toutes les réservations (admin)
app.post('/api/reset-all', (req, res) => {
  const { adminKey } = req.body;
  
  if (adminKey !== 'reset123') {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  
  reservedStations.clear();
  ipReservations.clear();
  
  io.emit('allStationsReleased');
  res.json({ success: true });
});

// Gestion des connexions WebSocket
io.on('connection', (socket) => {
  console.log('Nouvelle connexion:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Déconnexion:', socket.id);
  });
});

// Servir le fichier HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚇 Serveur démarré sur le port ${PORT}`);
  console.log(`📱 Ouvrez http://localhost:${PORT} dans votre navigateur`);
});