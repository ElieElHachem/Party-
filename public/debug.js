let debugLog = document.getElementById('debugLog');
let stations = [];

function log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : '✅';
    debugLog.textContent += `[${timestamp}] ${prefix} ${message}\n`;
    debugLog.scrollTop = debugLog.scrollHeight;
}

function clearLogs() {
    debugLog.textContent = '';
    log('Logs effacés');
}

async function testAPI() {
    log('Test de l\'API /api/stations...');
    
    try {
        const start = Date.now();
        const response = await fetch('/api/stations');
        const duration = Date.now() - start;
        
        log(`Réponse reçue en ${duration}ms - Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            stations = data;
            log(`✅ ${data.length} stations chargées`);
            
            document.getElementById('apiStatus').textContent = 'OK';
            document.getElementById('apiStatus').className = 'status ok';
            
            updateStats();
            renderStations();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        log(`❌ Erreur API: ${error.message}`, 'error');
        document.getElementById('apiStatus').textContent = 'Erreur';
        document.getElementById('apiStatus').className = 'status error';
    }
}

async function testReservation() {
    if (stations.length === 0) {
        log('❌ Chargez d\'abord les stations!', 'error');
        return;
    }

    const availableStations = stations.filter(s => !s.reserved);
    if (availableStations.length === 0) {
        log('❌ Aucune station disponible pour le test', 'error');
        return;
    }

    const testStation = availableStations[0].name;
    log(`Test de réservation: ${testStation}`);

    try {
        const response = await fetch('/api/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ station: testStation })
        });

        const result = await response.json();
        
        if (response.ok) {
            log(`✅ Réservation OK: ${testStation}`);
            testAPI(); // Recharger pour voir le changement
        } else {
            log(`❌ Erreur réservation: ${result.error}`, 'error');
        }

    } catch (error) {
        log(`❌ Erreur réseau: ${error.message}`, 'error');
    }
}

function updateStats() {
    const total = stations.length;
    const reserved = stations.filter(s => s.reserved).length;
    const available = total - reserved;

    document.getElementById('totalStations').textContent = total;
    document.getElementById('availableStations').textContent = available;
    document.getElementById('reservedStations').textContent = reserved;
}

function renderStations() {
    const list = document.getElementById('stationsList');
    
    if (stations.length === 0) {
        list.innerHTML = '<p style="color: #ff6666;">Aucune station chargée</p>';
        return;
    }

    list.innerHTML = stations
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(station => {
            const status = station.reserved ? 
                '<span style="color: #ff6666;">🔒 PRISE</span>' : 
                '<span style="color: #66ff66;">✅ LIBRE</span>';
            
            return `<div style="padding: 5px; border-bottom: 1px solid #444;">
                🚇 ${station.name} - ${status}
            </div>`;
        }).join('');
}

// Test WebSocket
function testWebSocket() {
    if (typeof io !== 'undefined') {
        try {
            const socket = io();
            
            socket.on('connect', () => {
                log('✅ WebSocket connecté');
                document.getElementById('socketStatus').textContent = 'OK';
                document.getElementById('socketStatus').className = 'status ok';
            });

            socket.on('connect_error', (error) => {
                log(`❌ Erreur WebSocket: ${error}`, 'error');
                document.getElementById('socketStatus').textContent = 'Erreur';
                document.getElementById('socketStatus').className = 'status error';
            });

            socket.on('disconnect', () => {
                log('⚠️ WebSocket déconnecté', 'warning');
                document.getElementById('socketStatus').textContent = 'Déconnecté';
                document.getElementById('socketStatus').className = 'status warning';
            });

        } catch (error) {
            log(`❌ Impossible d'initialiser WebSocket: ${error}`, 'error');
            document.getElementById('socketStatus').textContent = 'Non disponible';
            document.getElementById('socketStatus').className = 'status error';
        }
    } else {
        log('❌ Socket.io non chargé', 'error');
        document.getElementById('socketStatus').textContent = 'Non chargé';
        document.getElementById('socketStatus').className = 'status error';
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Boutons
    document.getElementById('testAPIBtn').addEventListener('click', testAPI);
    document.getElementById('testReservationBtn').addEventListener('click', testReservation);
    document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);

    // Initialisation
    log('🚀 Debug page initialisée');
    log('🔍 Vérification de l\'environnement...');
    
    // Tests automatiques au chargement
    setTimeout(() => {
        testAPI();
        testWebSocket();
    }, 500);

    // Auto-refresh toutes les 10 secondes
    setInterval(() => {
        if (stations.length > 0) {
            testAPI();
        }
    }, 10000);
});