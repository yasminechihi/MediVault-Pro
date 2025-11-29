require('dotenv').config();

module.exports = {
  // Configuration de l'application
  app: {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // Sécurité
  security: {
    jwtSecret: process.env.JWT_SECRET || 'medical-secret-key-change-in-production',
    bcryptRounds: 10,
    tokenExpiry: '24h'
  },
  
  // Email
  email: {
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.FROM_EMAIL || 'noreply@medivault-pro.fr'
  },
  
  // Azure
  azure: {
    keyVaultName: process.env.KEY_VAULT_NAME,
    tenantId: process.env.AZURE_TENANT_ID,
    clientId: process.env.AZURE_CLIENT_ID,
    clientSecret: process.env.AZURE_CLIENT_SECRET
  }
};