const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initializeDatabase } = require('./database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware de sécurité
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
  }
});
app.use('/api/', limiter);

// Import des routes
const authRoutes = require('./routes/auth').router;
const patientsRoutes = require('./routes/patients');
const encryptionRoutes = require('./routes/encryption');
const vaultRoutes = require('./routes/vault');
const patientDataRoutes = require('./routes/patientData');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/crypto', encryptionRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/patient-data', patientDataRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'MediVault Pro - Service opérationnel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Route racine
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Bienvenue sur MediVault Pro API',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// Middleware de gestion d'erreurs
app.use((error, req, res, next) => {
  console.error('Erreur serveur:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Route 404 - Doit être la dernière
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route non trouvée',
    path: req.originalUrl
  });
});

// Gestion propre de l'arrêt du serveur
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt du serveur...');
  process.exit(0);
});

// Initialiser la base de données et démarrer le serveur
async function startServer() {
  try {
    console.log('🔄 Initialisation de la base de données...');
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n🏥 MediVault Pro server running on port ${PORT}`);
      console.log(`🔐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🗄️ Database: ${process.env.DB_NAME || 'medivault'}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log('✅ Serveur démarré avec succès!\n');
    });
    
  } catch (error) {
    console.error('❌ Erreur critique lors du démarrage du serveur:', error);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();