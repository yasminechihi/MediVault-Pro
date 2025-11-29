const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { pool } = require('../database');
const router = express.Router();

const mfaSessions = new Map();
const pendingRegistrations = new Map();

// Configuration email conditionnelle
let emailTransporter = null;

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log('✅ SMTP configuré');
} else {
  console.log('🔧 Mode développement - Codes affichés dans la console');
}

// Route d'inscription
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;

    // Validation
    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, mot de passe, nom et rôle sont requis'
      });
    }

    if (!['doctor', 'patient'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Rôle invalide. Choisissez "doctor" ou "patient"'
      });
    }

    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un compte avec cet email existe déjà'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 6 caractères'
      });
    }

    // Hacher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Générer le code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = require('crypto').randomBytes(32).toString('hex');

    // Stocker l'inscription en attente
    pendingRegistrations.set(sessionId, {
      userData: {
        email,
        password: hashedPassword,
        name,
        phone: phone || '',
        role,
        verified: false
      },
      code: verificationCode,
      expires: Date.now() + 30 * 60 * 1000
    });

    // 🔧 ENVOI DU CODE (DÉVELOPPEMENT)
    console.log('\n📧 === NOUVELLE INSCRIPTION ===');
    console.log('👤 Nom:', name);
    console.log('📧 Email:', email);
    console.log('🎭 Rôle:', role);
    console.log('🔐 CODE DE VÉRIFICATION:', verificationCode);
    console.log('📝 Copiez ce code dans le formulaire de vérification');
    console.log('⏰ Code valable 30 minutes');
    console.log('==============================\n');

    // Essayer d'envoyer un email si configuré
    if (emailTransporter) {
      try {
        await sendVerificationEmail(email, verificationCode, name, role);
        console.log('✅ Email envoyé');
      } catch (emailError) {
        console.log('❌ Erreur email, code affiché ci-dessus');
      }
    }

    res.json({
      success: true,
      session: sessionId,
      message: emailTransporter 
        ? 'Code de vérification envoyé à votre email' 
        : 'Code affiché dans la console (mode développement)'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription'
    });
  }
});

// Route de connexion
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Récupérer l'utilisateur depuis la base de données
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND role = ?',
      [email, role]
    );

    const user = users[0];
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides ou rôle incorrect'
      });
    }

    // Vérifier si l'email est vérifié
    if (!user.verified) {
      return res.status(401).json({
        success: false,
        message: 'Veuillez vérifier votre email avant de vous connecter'
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Générer code MFA
    const mfaCode = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = require('crypto').randomBytes(32).toString('hex');

    mfaSessions.set(sessionId, {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      code: mfaCode,
      expires: Date.now() + 10 * 60 * 1000
    });

    // 🔧 ENVOI DU CODE MFA (DÉVELOPPEMENT)
    console.log('\n📧 === CONNEXION ===');
    console.log('👤 Utilisateur:', user.name);
    console.log('📧 Email:', user.email);
    console.log('🎭 Rôle:', user.role);
    console.log('🔐 CODE MFA:', mfaCode);
    console.log('📝 Copiez ce code dans le formulaire MFA');
    console.log('⏰ Code valable 10 minutes');
    console.log('=====================\n');

    if (emailTransporter) {
      try {
        await sendMfaEmail(user.email, mfaCode, user.name);
        console.log('✅ Email MFA envoyé');
      } catch (emailError) {
        console.log('❌ Erreur email MFA, code affiché ci-dessus');
      }
    }

    res.json({
      success: true,
      session: sessionId,
      message: emailTransporter 
        ? 'Code de sécurité envoyé à votre email' 
        : 'Code MFA affiché dans la console'
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'authentification'
    });
  }
});

// Vérification de l'email
router.post('/verify-email', async (req, res) => {
  try {
    const { session, code } = req.body;

    const pendingRegistration = pendingRegistrations.get(session);
    if (!pendingRegistration) {
      return res.status(401).json({
        success: false,
        message: 'Session invalide ou expirée'
      });
    }

    if (Date.now() > pendingRegistration.expires) {
      pendingRegistrations.delete(session);
      return res.status(401).json({
        success: false,
        message: 'Code de vérification expiré'
      });
    }

    if (pendingRegistration.code !== code) {
      return res.status(401).json({
        success: false,
        message: 'Code de vérification incorrect'
      });
    }

    // Créer l'utilisateur dans la base de données
    const userData = pendingRegistration.userData;
    
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, phone, verified) VALUES (?, ?, ?, ?, ?, ?)',
      [userData.name, userData.email, userData.password, userData.role, userData.phone, true]
    );

    const userId = result.insertId;

    // Générer le token
    const token = jwt.sign(
      { 
        id: userId,
        email: userData.email, 
        role: userData.role,
        name: userData.name 
      },
      process.env.JWT_SECRET || 'medical-secret-key',
      { expiresIn: '24h' }
    );

    // Nettoyer
    pendingRegistrations.delete(session);

    console.log('✅ Compte vérifié:', userData.email, '- Rôle:', userData.role);

    res.json({
      success: true,
      token: token,
      user: {
        id: userId,
        email: userData.email,
        role: userData.role,
        name: userData.name
      },
      message: 'Compte créé avec succès!'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
});

// Vérification MFA
router.post('/verify-mfa', (req, res) => {
  try {
    const { session, code } = req.body;

    const sessionData = mfaSessions.get(session);
    if (!sessionData) {
      return res.status(401).json({
        success: false,
        message: 'Session invalide ou expirée'
      });
    }

    if (Date.now() > sessionData.expires) {
      mfaSessions.delete(session);
      return res.status(401).json({
        success: false,
        message: 'Code de sécurité expiré'
      });
    }

    if (sessionData.code !== code) {
      return res.status(401).json({
        success: false,
        message: 'Code de sécurité incorrect'
      });
    }

    const user = sessionData.user;
    const token = jwt.sign(
      { 
        id: user.id,
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      process.env.JWT_SECRET || 'medical-secret-key',
      { expiresIn: '24h' }
    );

    // Nettoyer la session MFA
    mfaSessions.delete(session);

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      },
      message: 'Authentification réussie'
    });

  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
});

// Fonctions d'envoi d'email
async function sendVerificationEmail(to, code, userName, role) {
  if (!emailTransporter) return;

  const roleText = role === 'doctor' ? 'Médecin' : 'Patient';

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: to,
    subject: `MediVault Pro - Vérification de votre compte ${roleText}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">MediVault Pro</h2>
        <p>Bonjour ${userName},</p>
        <p>Merci de vous être inscrit en tant que <strong>${roleText}</strong> sur notre plateforme médicale sécurisée.</p>
        <p>Votre code de vérification est :</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
          <strong>${code}</strong>
        </div>
        <p>Ce code expirera dans 30 minutes.</p>
        <p><em>Si vous n'êtes pas à l'origine de cette inscription, veuillez ignorer cet email.</em></p>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

async function sendMfaEmail(to, code, userName) {
  if (!emailTransporter) return;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: to,
    subject: 'MediVault Pro - Code de Sécurité',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c5aa0;">MediVault Pro</h2>
        <p>Bonjour ${userName},</p>
        <p>Votre code de sécurité pour accéder à la plateforme médicale est :</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; margin: 20px 0;">
          <strong>${code}</strong>
        </div>
        <p>Ce code expirera dans 10 minutes.</p>
        <p><em>Si vous n'êtes pas à l'origine de cette demande, veuillez contacter immédiatement l'administration.</em></p>
      </div>
    `
  };

  await emailTransporter.sendMail(mailOptions);
}

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token d\'authentification manquant'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'medical-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token invalide'
      });
    }
    req.user = user;
    next();
  });
};

module.exports = { router, authenticateToken };