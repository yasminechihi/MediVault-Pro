const express = require('express');
const { authenticateToken } = require('./auth');
const cryptoUtils = require('../cryptoUtils');
const router = express.Router();

// Chiffrement César
router.post('/cesar/encrypt', authenticateToken, (req, res) => {
  try {
    const { text, key } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte requis'
      });
    }

    const encrypted = cryptoUtils.cesarCipher(text, key || 3, true);
    
    res.json({
      success: true,
      result: encrypted,
      algorithm: 'César',
      keyUsed: key || 3
    });

  } catch (error) {
    console.error('Cesar encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chiffrement'
    });
  }
});

router.post('/cesar/decrypt', authenticateToken, (req, res) => {
  try {
    const { text, key } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte requis'
      });
    }

    const decrypted = cryptoUtils.cesarCipher(text, key || 3, false);
    
    res.json({
      success: true,
      result: decrypted,
      algorithm: 'César',
      keyUsed: key || 3
    });

  } catch (error) {
    console.error('Cesar decryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déchiffrement'
    });
  }
});

// Chiffrement Vigenère
router.post('/vigenere/encrypt', authenticateToken, (req, res) => {
  try {
    const { text, key } = req.body;
    
    if (!text || !key) {
      return res.status(400).json({
        success: false,
        message: 'Texte et clé requis'
      });
    }

    const encrypted = cryptoUtils.vigenereCipher(text, key, true);
    
    res.json({
      success: true,
      result: encrypted,
      algorithm: 'Vigenère',
      keyUsed: key
    });

  } catch (error) {
    console.error('Vigenere encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chiffrement'
    });
  }
});

router.post('/vigenere/decrypt', authenticateToken, (req, res) => {
  try {
    const { text, key } = req.body;
    
    if (!text || !key) {
      return res.status(400).json({
        success: false,
        message: 'Texte et clé requis'
      });
    }

    const decrypted = cryptoUtils.vigenereCipher(text, key, false);
    
    res.json({
      success: true,
      result: decrypted,
      algorithm: 'Vigenère',
      keyUsed: key
    });

  } catch (error) {
    console.error('Vigenere decryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déchiffrement'
    });
  }
});

// Chiffrement AES
router.post('/aes/encrypt', authenticateToken, (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte requis'
      });
    }

    const encrypted = cryptoUtils.aesEncrypt(text);
    
    res.json({
      success: true,
      encrypted: encrypted,
      algorithm: 'AES-256-CBC'
    });

  } catch (error) {
    console.error('AES encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chiffrement AES'
    });
  }
});

router.post('/aes/decrypt', authenticateToken, (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte chiffré requis'
      });
    }

    const decrypted = cryptoUtils.aesDecrypt(text);
    
    res.json({
      success: true,
      decrypted: decrypted,
      algorithm: 'AES-256-CBC'
    });

  } catch (error) {
    console.error('AES decryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déchiffrement AES'
    });
  }
});

// RSA Key Generation
router.post('/rsa/generate-keys', authenticateToken, (req, res) => {
  try {
    const { publicKey, privateKey } = cryptoUtils.generateRSAKeyPair();
    
    res.json({
      success: true,
      public_key: publicKey,
      private_key: privateKey,
      algorithm: 'RSA-2048'
    });

  } catch (error) {
    console.error('RSA key generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération des clés RSA'
    });
  }
});

router.post('/rsa/encrypt', authenticateToken, (req, res) => {
  try {
    const { text, publicKey } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte requis'
      });
    }

    const encrypted = cryptoUtils.rsaEncrypt(text, publicKey);
    
    res.json({
      success: true,
      encrypted: encrypted,
      algorithm: 'RSA-2048'
    });

  } catch (error) {
    console.error('RSA encryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chiffrement RSA'
    });
  }
});

router.post('/rsa/decrypt', authenticateToken, (req, res) => {
  try {
    const { text, privateKey } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Texte chiffré requis'
      });
    }

    const decrypted = cryptoUtils.rsaDecrypt(text, privateKey);
    
    res.json({
      success: true,
      decrypted: decrypted,
      algorithm: 'RSA-2048'
    });

  } catch (error) {
    console.error('RSA decryption error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du déchiffrement RSA'
    });
  }
});

module.exports = router;