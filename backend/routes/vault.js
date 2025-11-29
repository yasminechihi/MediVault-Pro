const express = require('express');
const { authenticateToken } = require('./auth');
const azureUtils = require('../azureUtils');
const router = express.Router();

// Route pour lister tous les secrets
router.get('/secrets', authenticateToken, async (req, res) => {
  try {
    const secrets = await azureUtils.listSecrets();
    
    res.json({
      success: true,
      secrets: secrets,
      count: secrets.length
    });

  } catch (error) {
    console.error('Key Vault list error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des secrets'
    });
  }
});

// Les autres routes existantes...
router.post('/store', authenticateToken, async (req, res) => {
  try {
    const { name, value } = req.body;
    
    if (!name || !value) {
      return res.status(400).json({
        success: false,
        message: 'Nom et valeur du secret requis'
      });
    }

    const version = await azureUtils.storeSecretInVault(name, value);
    
    res.json({
      success: true,
      version: version,
      message: 'Secret stocké avec succès dans Azure Key Vault'
    });

  } catch (error) {
    console.error('Key Vault store error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du stockage dans Key Vault'
    });
  }
});

router.get('/retrieve', authenticateToken, async (req, res) => {
  try {
    const { name } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Nom du secret requis'
      });
    }

    const value = await azureUtils.retrieveSecretFromVault(name);
    
    if (!value) {
      return res.status(404).json({
        success: false,
        message: 'Secret non trouvé'
      });
    }

    res.json({
      success: true,
      value: value,
      message: 'Secret récupéré avec succès'
    });

  } catch (error) {
    console.error('Key Vault retrieve error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération depuis Key Vault'
    });
  }
});

// Route pour supprimer un secret
router.delete('/secrets/:name', authenticateToken, async (req, res) => {
  try {
    const { name } = req.params;
    
    const success = await azureUtils.deleteSecretFromVault(name);
    
    if (success) {
      res.json({
        success: true,
        message: 'Secret supprimé avec succès'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Secret non trouvé'
      });
    }

  } catch (error) {
    console.error('Key Vault delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du secret'
    });
  }
});

module.exports = router;