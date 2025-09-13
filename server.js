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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting par IP
let rateLimiter = new RateLimiterMemory({
  points: 1, // 1 sélection par IP
  duration: 86400 * 24, // Reset après 24h
});

// Stockage en mémoire des stations et des IPs
let reservedStations = new Map(); // station -> IP
let ipReservations = new Map(); // IP -> station

// Liste complète et dédoublonnée des stations du métro de Paris (au 2025)
const metroStations = [
  'Abbesses','Aimé Césaire','Alésia','Alexandre Dumas','Alma - Marceau','Anatole France','Anvers',
  'Assemblée nationale','Aubervilliers - Pantin - Quatre Chemins','Avenue Émile Zola','Avron','Aéroport d\'Orly',
  'Bagneux - Lucie Aubrac','Balard','Barbara','Barbès - Rochechouart','Basilique de Saint-Denis','Bastille',
  'Bel-Air','Belleville','Bérault','Bercy','Bibliothèque François Mitterrand','Billancourt','Bir-Hakeim',
  'Blanche','Bobigny - Pablo Picasso','Bobigny - Pantin - Raymond Queneau','Boissière','Bolivar','Bonne Nouvelle',
  'Botzaris','Boucicaut','Boulogne - Jean Jaurès','Boulogne - Pont de Saint-Cloud','Bourse','Bréguet - Sabin',
  'Brochant','Buttes Chaumont','Buzenval','Cadet','Cambronne','Campo-Formio','Cardinal Lemoine','Carrefour Pleyel',
  'Censier - Daubenton','Champs-Élysées - Clemenceau','Chardon-Lagache','Charenton - Écoles','Charles de Gaulle - Étoile',
  'Charles Michels','Charonne','Château d\'Eau','Château de Vincennes','Château-Landon','Château Rouge','Châtelet',
  'Châtillon - Montrouge','Chaussée d\'Antin - La Fayette','Chemin Vert','Chevaleret','Chevilly-Larue','Cité',
  'Cluny - La Sorbonne','Colonel Fabien','Commerce','Concorde','Convention','Corentin Cariou','Corentin Celton','Corvisart',
  'Coteaux Beauclair','Cour Saint-Émilion','Courcelles','Couronnes','Créteil - L\'Échat','Créteil - Préfecture',
  'Créteil - Université','Crimée','Croix de Chavaux','Daumesnil','Danube','Denfert-Rochereau','Dugommier','Dupleix',
  'Duroc','École Militaire','École vétérinaire de Maisons-Alfort','Edgar Quinet','Église d\'Auteuil','Église de Pantin',
  'Esplanade de La Défense','Étienne Marcel','Europe','Exelmans','Faidherbe - Chaligny','Falguière','Félix Faure',
  'Filles du Calvaire','Fort d\'Aubervilliers','Franklin D. Roosevelt','Front Populaire','Gabriel Péri','Gaîté','Gallieni',
  'Gambetta','Gare d\'Austerlitz','Gare de l\'Est','Gare de Lyon','Gare du Nord','Garibaldi','George V','Glacière','Goncourt',
  'Grands Boulevards','Guy Môquet','Havre - Caumartin','Hoche','Hôpital Bicêtre','Hôtel de Ville','Iéna','Invalides',
  'Jacques Bonsergent','Jasmin','Jaurès','Javel - André Citroën','Jourdain','Jules Joffrin','Jussieu','Kléber','La Chapelle',
  'La Courneuve - 8 Mai 1945','La Défense','La Dhuys','La Fourche','La Motte-Picquet - Grenelle','La Muette','La Tour-Maubourg',
  'Lamarck - Caulaincourt','Laumière','Le Kremlin-Bicêtre','Le Peletier','Ledru-Rollin','Les Agnettes','Les Courtilles','Les Gobelins',
  'Les Halles','Les Sablons','L\'Haÿ-les-Roses','Liberté','Liège','Louis Blanc','Louise Michel','Lourmel','Louvre - Rivoli',
  'Mabillon','Madeleine','Mairie d\'Aubervilliers','Mairie d\'Issy','Mairie d\'Ivry','Mairie de Clichy','Mairie de Montreuil',
  'Mairie de Montrouge','Mairie de Saint-Ouen','Mairie des Lilas','Maison Blanche','Maisons-Alfort - Les Juilliottes',
  'Maisons-Alfort - Stade','Malakoff - Plateau de Vanves','Malakoff - Rue Étienne Dolet','Malesherbes','Maraîchers','Marcadet - Poissonniers',
  'Marcel Sembat','Marx Dormoy','Maubert - Mutualité','Ménilmontant','Michel Bizot','Michel-Ange - Auteuil','Michel-Ange - Molitor',
  'Mirabeau','Miromesnil','Monceau','Montgallet','Montparnasse - Bienvenüe','Montreuil - Hôpital','Mouton-Duvernet','Nation','Nationale',
  'Notre-Dame-de-Lorette','Notre-Dame-des-Champs','Oberkampf','Odéon','Olympiades','Opéra','Ourcq','Palais-Royal - Musée du Louvre',
  'Parmentier','Passy','Pasteur','Pelleport','Père Lachaise','Pereire','Pernety','Philippe Auguste','Picpus','Pierre et Marie Curie',
  'Pigalle','Place d\'Italie','Place de Clichy','Place des Fêtes','Place Monge','Plaisance','Pointe du Lac','Poissonnière',
  'Pont de Levallois - Bécon','Pont de Neuilly','Pont de Sèvres','Pont Cardinet','Pont Marie','Pont-Neuf','Porte Dauphine','Porte d\'Auteuil',
  'Porte de Bagnolet','Porte de Champerret','Porte de Charenton','Porte de Choisy','Porte de Clichy','Porte de Clignancourt','Porte de la Chapelle',
  'Porte de la Villette','Porte de Montreuil','Porte de Pantin','Porte de Saint-Cloud','Porte de Saint-Ouen','Porte de Vanves','Porte de Versailles',
  'Porte de Vincennes','Porte des Lilas','Porte d\'Italie','Porte d\'Ivry','Porte Dorée','Porte d\'Orléans','Porte Maillot','Pré-Saint-Gervais',
  'Pyramides','Pyrénées','Quai de la Gare','Quai de la Rapée','Quatre-Septembre','Rambuteau','Ranelagh','Raspail','Réaumur - Sébastopol',
  'Rennes','République','Reuilly - Diderot','Richard-Lenoir','Richelieu - Drouot','Riquet','Robespierre','Romainville - Carnot','Rome',
  'Rosny-Bois-Perrier','Rue de la Pompe','Rue des Boulets','Rue du Bac','Rue Saint-Maur','Saint-Ambroise','Saint-Augustin','Saint-Denis Pleyel',
  'Saint-Denis - Porte de Paris','Saint-Denis - Université','Saint-Fargeau','Saint-François-Xavier','Saint-Georges','Saint-Germain-des-Prés','Saint-Jacques',
  'Saint-Lazare','Saint-Mandé','Saint-Marcel','Saint-Michel','Saint-Ouen','Saint-Paul','Saint-Philippe du Roule','Saint-Placide','Saint-Sébastien - Froissart',
  'Saint-Sulpice','Ségur','Sentier','Serge Gainsbourg','Sèvres - Babylone','Sèvres - Lecourbe','Simplon','Solférino','Stalingrad','Strasbourg - Saint-Denis',
  'Sully - Morland','Télégraphe','Temple','Ternes','Thiais - Orly','Tolbiac','Trinité - d\'Estienne d\'Orves','Trocadéro','Tuileries','Vaneau','Varenne',
  'Vaugirard','Vavin','Victor Hugo','Villejuif - Gustave Roussy','Villejuif - Léo Lagrange','Villejuif - Louis Aragon','Villejuif - Paul Vaillant-Couturier',
  'Villiers','Volontaires','Voltaire','Wagram'
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

// Efface les clés du rate limiter pour une IP donnée (gère variantes IPv6/IPv4)
async function clearRateLimiterForIP(ip) {
  if (!ip || !rateLimiter) return;
  const variants = new Set();
  variants.add(ip);
  // IPv4 mapped in IPv6 -> ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) variants.add(ip.replace('::ffff:', ''));
  // ::1 -> 127.0.0.1
  if (ip === '::1') variants.add('127.0.0.1');
  // If it's plain IPv4, add mapped form
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) variants.add('::ffff:' + ip);
  // strip zone id
  variants.add(ip.split('%')[0]);

  await Promise.all(Array.from(variants).map(async (key) => {
    try {
      if (typeof rateLimiter.delete === 'function') {
        await rateLimiter.delete(key).catch(() => {});
        console.log('RateLimiter key deleted for', key);
      }
    } catch (e) {
      // ignore errors
    }
  }));
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
app.post('/api/release', async (req, res) => {
  const { station, adminKey } = req.body;

  // Clé admin simple (à changer en production)
  if (adminKey !== 'reset123') {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  if (reservedStations.has(station)) {
    const ip = reservedStations.get(station);
    reservedStations.delete(station);
    ipReservations.delete(ip);

    // Effacer la clé de rate limiter pour l'IP libérée
    try {
      await clearRateLimiterForIP(ip);
    } catch (e) {
      console.error('Erreur en effaçant la clé rateLimiter pour IP:', e);
    }

    io.emit('stationReleased', { station });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Station non réservée' });
  }
});

// Route pour reset toutes les réservations (admin)
app.post('/api/reset-all', async (req, res) => {
  const { adminKey } = req.body;

  if (adminKey !== 'reset123') {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  // Réinitialiser complètement le rate limiter pour être sûr que toutes les clés sont supprimées
  try {
    rateLimiter = new RateLimiterMemory({
      points: 1,
      duration: 86400*30,
    });
    console.log('RateLimiter réinitialisé lors du reset global');
  } catch (err) {
    console.error('Erreur en recréant le rateLimiter:', err);
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