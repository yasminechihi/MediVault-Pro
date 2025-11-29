const express = require('express');
const { authenticateToken } = require('./auth');
const { pool } = require('../database');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ------------------- Multer pour PDF -------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
// ---------------------------------------------------
// INITIALISATION TABLE
// ---------------------------------------------------
const initializePatientsTable = async () => {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS patient_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        patient_id VARCHAR(50) NOT NULL,
        medical_record TEXT,
        encryption_algorithm VARCHAR(50) DEFAULT 'none',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    console.log("✅ Table patient_records prête");
  } catch (error) {
    console.error("Erreur init table patient_records:", error);
  }
};

initializePatientsTable();

// ---------------------------------------------------
// AJOUT D’UN DOSSIER PATIENT (SANS FICHIER)
// ---------------------------------------------------
router.post('/', authenticateToken, upload.single('pdfFile'), async (req, res) => {
  try {
    if (req.user.role !== "doctor") return res.status(403).json({ success: false, message: "Accès réservé aux médecins" });

    const { name, patientId, medicalRecord, encryption } = req.body;
    if (!name || !patientId || !medicalRecord) return res.status(400).json({ success: false, message: "Nom, ID patient et dossier médical requis" });

    const pdfPath = req.file ? req.file.path : null;

    const [result] = await pool.execute(
      `INSERT INTO patient_records (name, patient_id, medical_record, pdf_path, encryption_algorithm, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, patientId, medicalRecord, pdfPath, encryption || "none", req.user.id]
    );

    res.json({ success: true, message: "Dossier patient créé", patient: { id: result.insertId, name, patientId, medicalRecord, pdfPath, encryption } });

  } catch (error) {
    console.error("Erreur create patient:", error);
    res.status(500).json({ success: false, message: "Erreur lors de la création du dossier" });
  }
});

// ---------------------------------------------------
// RÉCUPÉRER LES DOSSIERS DU MÉDECIN
// ---------------------------------------------------
router.get('/', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Accès réservé aux médecins"
      });
    }

    const [patients] = await pool.execute(
      `SELECT * FROM patient_records 
       WHERE created_by = ? 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      count: patients.length,
      patients
    });

  } catch (error) {
    console.error("Erreur récuperation patients:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des dossiers"
    });
  }
});

// ---------------------------------------------------
// SUPPRESSION
// ---------------------------------------------------
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id;

    const [patients] = await pool.execute(
      `SELECT * FROM patient_records 
       WHERE id = ? AND created_by = ?`,
      [patientId, req.user.id]
    );

    if (patients.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dossier introuvable"
      });
    }

    await pool.execute(
      "DELETE FROM patient_records WHERE id = ?",
      [patientId]
    );

    res.json({
      success: true,
      message: "Dossier supprimé avec succès"
    });

  } catch (error) {
    console.error("Erreur suppression:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la suppression du dossier"
    });
  }
});
router.get('/read/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;

    // Récupérer le dossier
    const [rows] = await pool.execute(
      "SELECT * FROM patient_records WHERE id = ? AND created_by = ?",
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.json({ success: false, message: "Dossier introuvable" });
    }

    const record = rows[0];
    let decryptedText = record.medical_record || "";

    // Déchiffrement selon le type choisi
    switch (record.encryption_algorithm) {

      case "cesar": {
        const key = await azureUtils.retrieveSecretFromVault(record.encryption_key);
        decryptedText = cryptoUtils.cesarCipher(record.medical_record, parseInt(key), false);
        break;
      }

      case "vigenere": {
        const key = await azureUtils.retrieveSecretFromVault(record.encryption_key);
        decryptedText = cryptoUtils.vigenereCipher(record.medical_record, key, false);
        break;
      }

      case "aes": {
        decryptedText = cryptoUtils.aesDecrypt(record.medical_record);
        break;
      }

      case "none":
      default:
        decryptedText = record.medical_record;
        break;
    }

    res.json({
      success: true,
      record: decryptedText
    });

  } catch (error) {
    console.error("Erreur lecture:", error);
    res.json({ success: false, message: "Erreur lors de la lecture du dossier" });
  }
});

router.put('/edit/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { newText } = req.body;

    const [rows] = await pool.execute(
      "SELECT * FROM patient_records WHERE id = ? AND created_by = ?",
      [id, req.user.id]
    );

    if (rows.length === 0)
      return res.json({ success: false, message: "Dossier introuvable" });

    const record = rows[0];
    let encrypted = newText;

    // Rechiffrement
    if (record.encryption_algorithm === "cesar") {
      const key = await azureUtils.retrieveSecretFromVault(record.encryption_key);
      encrypted = cryptoUtils.cesarCipher(newText, parseInt(key), true);
    }

    if (record.encryption_algorithm === "vigenere") {
      const key = await azureUtils.retrieveSecretFromVault(record.encryption_key);
      encrypted = cryptoUtils.vigenereCipher(newText, key, true);
    }

    if (record.encryption_algorithm === "aes") {
      encrypted = cryptoUtils.aesEncrypt(newText);
    }

    await pool.execute(
      "UPDATE patient_records SET medical_record=? WHERE id=?",
      [encrypted, id]
    );

    res.json({ success: true });

  } catch (e) {
    console.error("Erreur modification:", e);
    res.json({ success: false, message: "Erreur lors de la modification" });
  }
});

// ------------------- LIRE DOSSIER + PDF -------------------
router.get('/read/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.execute(
      "SELECT * FROM patient_records WHERE id=? AND created_by=?",
      [id, req.user.id]
    );

    if (rows.length === 0) return res.json({ success: false, message: "Dossier introuvable" });

    const record = rows[0];
    let decryptedText = record.medical_record || "";

    switch (record.encryption_algorithm) {
      case "cesar":
        decryptedText = decryptedText; // TODO: chiffrement coté backend si besoin
        break;
      case "vigenere":
        decryptedText = decryptedText;
        break;
      case "aes":
        decryptedText = decryptedText;
        break;
      case "none":
      default:
        break;
    }

    res.json({ success: true, record: decryptedText, pdfPath: record.pdf_path });
  } catch (error) {
    console.error("Erreur lecture:", error);
    res.json({ success: false, message: "Erreur lors de la lecture du dossier" });
  }
});

// ------------------- Télécharger le PDF -------------------
router.get('/pdf/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.execute(
      "SELECT pdf_path FROM patient_records WHERE id=? AND created_by=?",
      [id, req.user.id]
    );

    if (rows.length === 0 || !rows[0].pdf_path) return res.status(404).json({ success: false, message: "PDF introuvable" });

    res.sendFile(path.resolve(rows[0].pdf_path));
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur téléchargement PDF" });
  }
});

module.exports = router;
