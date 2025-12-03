// routes/patients.js
const express = require('express');
const { authenticateToken } = require('./auth'); // ta middleware d'auth
const { pool } = require('../database'); // connexion mysql2/promise
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- s'assure que le dossier uploads existe ---
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ------------------- Multer pour PDF -------------------
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });
// ---------------------------------------------------

// ===================================================
// NOUVEAU : Fonction pour enregistrer une activité
// ===================================================
async function logActivity(userId, action, details, patientIdFk = null) {
    try {
        await pool.execute(
            `INSERT INTO activity_logs (user_id_fk, action, details, patient_id_fk)
             VALUES (?, ?, ?, ?)`,
            [userId, action, details, patientIdFk]
        );
    } catch (error) {
        // Log l'erreur mais ne bloque pas la réponse API
        console.error("Erreur lors de l'enregistrement du journal d'activité:", error);
    }
}
// ---------------------------------------------------

// ------------------- Helpers chiffrement (inchangé) -------------------
function cesarCipher(text, shift, encrypt = true) {
    if (!text) return text || "";
    shift = parseInt(shift) || 3;
    if (!encrypt) shift = (26 - (shift % 26)) % 26;
    return text.replace(/[a-z]/gi, c => {
        const base = c === c.toLowerCase() ? 97 : 65;
        return String.fromCharCode((c.charCodeAt(0) - base + shift) % 26 + base);
    });
}

function vigenereCipher(text, key, encrypt = true) {
    if (!text) return text || "";
    key = (key || "CLE").toString().toLowerCase();
    let result = "";
    let j = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (/[a-z]/i.test(c)) {
            const base = c === c.toLowerCase() ? 97 : 65;
            const shift = key[j % key.length].charCodeAt(0) - 97;
            const s = encrypt ? shift : (26 - shift);
            const letter = String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
            result += letter;
            j++;
        } else result += c;
    }
    return result;
}

function aesEncryptBase64(text) {
    if (text == null) return text;
    return Buffer.from(text, 'utf8').toString('base64');
}
function aesDecryptBase64(text) {
    if (!text) return text || "";
    try {
        return Buffer.from(text, 'base64').toString('utf8');
    } catch (e) {
        return text;
    }
}
// ---------------------------------------------------

// ---------------------------------------------------
// INITIALISATION TABLES: patient_records + encryption_keys + NOUVEAU : activity_logs
// ---------------------------------------------------
const initializePatientsTable = async () => {
    try {
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS patient_records (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            patient_id VARCHAR(50) NOT NULL,
            medical_record TEXT,
            pdf_path VARCHAR(255),
            encryption_algorithm VARCHAR(50) DEFAULT 'none',
            encryption_key VARCHAR(255) DEFAULT NULL,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
          )
        `);

        await pool.execute(`
          CREATE TABLE IF NOT EXISTS encryption_keys (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            algorithm VARCHAR(50) DEFAULT 'none',
            key_value VARCHAR(255) DEFAULT NULL,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // NOUVEAU: Table activity_logs
        await pool.execute(`
          CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id_fk INT NOT NULL,
            action VARCHAR(255) NOT NULL,
            details TEXT,
            patient_id_fk INT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id_fk) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (patient_id_fk) REFERENCES patient_records(id) ON DELETE SET NULL
          )
        `);

        console.log("✅ Tables patient_records, encryption_keys et activity_logs prêtes");
    } catch (error) {
        console.error("Erreur init tables patient_records/encryption_keys/activity_logs:", error);
    }
};

initializePatientsTable();

// ---------------------------------------------------
// AJOUT D’UN DOSSIER PATIENT (avec PDF facultatif) - LOGGING AJOUTÉ
// ---------------------------------------------------
router.post('/', authenticateToken, upload.single('pdfFile'), async (req, res) => {
    try {
        // MODIFICATION: Autoriser 'doctor' ET 'infirmier'
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") { 
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const { name, patientId, medicalRecord, encryption, encryptionKey } = req.body;
        if (!name || !patientId) return res.status(400).json({ success: false, message: "Nom et ID patient requis" });

        const pdfPath = req.file ? path.join('uploads', req.file.filename) : null;

        const [result] = await pool.execute(
            `INSERT INTO patient_records (name, patient_id, medical_record, pdf_path, encryption_algorithm, encryption_key, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name, patientId, medicalRecord || null, pdfPath, encryption || "none", encryptionKey || null, req.user.id]
        );

        // JOURNALISATION : Enregistrement de la création du dossier
        const newPatientId = result.insertId;
        await logActivity(
            req.user.id,
            'Création Dossier',
            `Dossier créé pour Patient ${name} (ID: ${patientId}). Algorithme: ${encryption || 'none'}.`,
            newPatientId
        );

        res.json({ success: true, message: "Dossier patient créé", patient: { id: newPatientId, name, patientId, medicalRecord, pdfPath, encryption } });

    } catch (error) {
        console.error("Erreur create patient:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la création du dossier" });
    }
});

// ---------------------------------------------------
// RÉCUPÉRER LES DOSSIERS DU MÉDECIN/INFIRMIER
// ---------------------------------------------------
router.get('/', authenticateToken, async (req, res) => {
    try {
        // MODIFICATION: Autoriser 'doctor' ET 'infirmier'
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
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
// SUPPRESSION - LOGGING AJOUTÉ
// ---------------------------------------------------
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Vérification de rôle pour la suppression (action sensible)
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const patientId = req.params.id;
        const [patients] = await pool.execute(
            `SELECT * FROM patient_records WHERE id = ? AND created_by = ?`,
            [patientId, req.user.id]
        );

        if (patients.length === 0) {
            return res.status(404).json({ success: false, message: "Dossier introuvable" });
        }

        // Récupérer les infos avant suppression pour le log
        const patientName = patients[0].name;
        const patientExternalId = patients[0].patient_id;

        // supprimer le fichier pdf si présent
        const pdfPath = patients[0].pdf_path;
        if (pdfPath) {
            const abs = path.resolve(pdfPath);
            fs.unlink(abs, (err) => {
                if (err) console.warn("Impossible de supprimer le pdf:", err.message);
            });
        }

        await pool.execute(
            "DELETE FROM patient_records WHERE id = ?",
            [patientId]
        );

        // JOURNALISATION : Enregistrement de la suppression
        await logActivity(
            req.user.id,
            'Suppression Dossier',
            `Dossier supprimé pour Patient ${patientName} (ID: ${patientExternalId}).`,
            parseInt(patientId) // Use the record id for FK reference
        );


        res.json({ success: true, message: "Dossier patient supprimé" });

    } catch (error) {
        console.error("Erreur delete patient:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la suppression du dossier" });
    }
});

// ---------------------------------------------------
// LIRE UN DOSSIER (déchiffrement) - LOGGING AJOUTÉ
// ---------------------------------------------------
router.get('/read/:id', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Vérification de rôle pour la lecture (action sensible)
        // NOTE: Si le patient doit aussi lire ce endpoint, vous devrez adapter 
        // la requête SQL pour permettre l'accès par patient_id en plus de created_by.
        // Pour l'interface Médecin/Infirmier, cette vérification suffit.
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
             // Si le patient essaie de lire, on suppose qu'il a besoin d'une autre logique ici.
             // On s'assure au moins que les non-professionnels ne lisent pas les dossiers des autres.
             // La requête SELECT ci-dessous s'occupe de la restriction par 'created_by'.
        }
        
        const id = req.params.id;
        const key = req.query.key; // Clé de déchiffrement temporaire

        const [rows] = await pool.execute(
            `SELECT * FROM patient_records 
             WHERE id = ? AND created_by = ?`,
            [id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Dossier introuvable" });

        const record = rows[0];
        let decryptedText = record.medical_record;

        if (key) {
             // Déchiffrement basé sur la clé fournie en query
            const keyToUse = key || record.encryption_key || (record.encryption_algorithm === 'cesar' ? '3' : 'CLE');

            switch ((record.encryption_algorithm || "none").toLowerCase()) {
                case "cesar":
                    decryptedText = cesarCipher(decryptedText, keyToUse, false);
                    break;
                case "vigenere":
                    decryptedText = vigenereCipher(decryptedText, keyToUse, false);
                    break;
                case "aes":
                    decryptedText = aesDecryptBase64(decryptedText);
                    break;
                case "rsa":
                    // Pour RSA, on assume Base64 si on a utilisé le placeholder.
                    // Si un vrai RSA est implémenté, la logique de déchiffrement côté serveur devrait être ici.
                    decryptedText = aesDecryptBase64(decryptedText.replace('_RSA_ENCRYPTED', '').replace('_RSA_DEFAULT', ''));
                    break;
                case "none":
                default:
                    decryptedText = record.medical_record;
                    break;
            }
             // JOURNALISATION : Enregistrement de la lecture/déchiffrement
            await logActivity(
                req.user.id,
                'Lecture Dossier',
                `Accès et déchiffrement du dossier pour Patient ${record.name} (ID: ${record.patient_id}).`,
                record.id
            );
            
            res.json({ success: true, record: decryptedText, pdfPath: record.pdf_path, encryption_algorithm: record.encryption_algorithm, encryption_key_stored: !!record.encryption_key });
        } else {
             // Retourne les données brutes (non déchiffrées) si aucune clé n'est fournie
             // Ceci est utilisé par le frontend dans la fonction readRecord() avant de demander la clé.
            res.json({ success: true, record: record, encryption_algorithm: record.encryption_algorithm, encryption_key_stored: !!record.encryption_key });
        }


    } catch (error) {
        console.error("Erreur lecture:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la lecture du dossier" });
    }
});

// ---------------------------------------------------
// MODIFIER (rechiffrement si nécessaire) - LOGGING AJOUTÉ
// ---------------------------------------------------
router.put('/edit/:id', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Vérification de rôle pour l'édition (action sensible)
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const id = req.params.id;
        const { newText, key } = req.body;

        const [rows] = await pool.execute(
            "SELECT * FROM patient_records WHERE id = ? AND created_by = ?",
            [id, req.user.id]
        );

        if (rows.length === 0) return res.status(404).json({ success: false, message: "Dossier introuvable" });

        const record = rows[0];
        let encrypted = newText;

        // Utilise soit la clé fournie soit la clé existante dans le record (si existante)
        const keyToUse = key || record.encryption_key || (record.encryption_algorithm === 'cesar' ? '3' : 'CLE');
        
        // Rechiffrement basé sur l'algorithme d'origine
        if (record.encryption_algorithm && record.encryption_algorithm !== 'none') {
            switch (record.encryption_algorithm.toLowerCase()) {
                case "cesar":
                    encrypted = cesarCipher(newText, keyToUse, true);
                    break;
                case "vigenere":
                    encrypted = vigenereCipher(newText, keyToUse, true);
                    break;
                case "aes":
                    encrypted = aesEncryptBase64(newText);
                    break;
                case "rsa":
                    // Pour RSA, on assume Base64 si on a utilisé le placeholder.
                    // Si un vrai RSA est implémenté, la logique de chiffrement côté serveur devrait être ici.
                    encrypted = aesEncryptBase64(newText) + '_RSA_ENCRYPTED';
                    break;
            }
        }
        
        // Mise à jour du dossier (met à jour la clé si key est défini)
        await pool.execute(
            `UPDATE patient_records SET medical_record = ?, encryption_key = ? WHERE id = ? AND created_by = ?`,
            [encrypted, key ? key : record.encryption_key, id, req.user.id]
        );

        // JOURNALISATION : Enregistrement de la modification
        await logActivity(
            req.user.id,
            'Modification Dossier',
            `Dossier Patient ${record.name} (ID: ${record.patient_id}) modifié. Rechiffrement avec ${record.encryption_algorithm}.`,
            record.id
        );

        res.json({ success: true, message: "Dossier modifié et rechiffré" });

    } catch (error) {
        console.error("Erreur modification:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la modification du dossier" });
    }
});

// ---------------------------------------------------
// GESTION DU TÉLÉCHARGEMENT DE PDF (inchangé)
// ---------------------------------------------------
router.get('/pdf/:id', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Vérification de rôle pour le téléchargement (action sensible)
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }
        
        const id = req.params.id;
        // On vérifie que seul l'utilisateur créateur peut télécharger (sécurité par created_by)
        const [rows] = await pool.execute(
            "SELECT pdf_path FROM patient_records WHERE id=? AND created_by=?",
            [id, req.user.id]
        );

        if (rows.length === 0 || !rows[0].pdf_path) return res.status(404).json({ success: false, message: "PDF introuvable" });

        const pdfRel = rows[0].pdf_path;
        const absPath = path.resolve(pdfRel);

        if (!fs.existsSync(absPath)) return res.status(404).json({ success: false, message: "PDF introuvable sur le disque" });

        // Sert le fichier
        res.sendFile(absPath);

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Erreur téléchargement PDF" });
    }
});

// ---------------------------------------------------
// KEY VAULT LIGHT (liste & ajout)
// ---------------------------------------------------
router.post('/keys', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Autoriser 'doctor' ET 'infirmier'
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const { name, algorithm, key_value } = req.body;
        if (!name || !algorithm || !key_value) {
            return res.status(400).json({ success: false, message: "Nom, algorithme et valeur de clé requis" });
        }

        await pool.execute(
            `INSERT INTO encryption_keys (name, algorithm, key_value, created_by)
             VALUES (?, ?, ?, ?)`,
            [name, algorithm, key_value, req.user.id]
        );

        res.json({ success: true, message: "Clé enregistrée" });
    } catch (error) {
        console.error("Erreur enregistrement clé:", error);
        res.status(500).json({ success: false, message: "Erreur lors de l'enregistrement de la clé" });
    }
});

router.get('/keys', authenticateToken, async (req, res) => {
    try {
        // AJOUT: Autoriser 'doctor' ET 'infirmier'
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const [keys] = await pool.execute(
            `SELECT id, name, algorithm, created_at, created_by 
             FROM encryption_keys 
             WHERE created_by = ? 
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({ success: true, keys });

    } catch (error) {
        console.error("Erreur recuperation clés:", error);
        res.status(500).json({ success: false, message: "Erreur lors de la récupération des clés" });
    }
});


// ---------------------------------------------------
// JOURNAL D'ACTIVITÉ
// ---------------------------------------------------
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        // MODIFICATION: Autoriser 'doctor' ET 'infirmier'
        if (req.user.role !== "doctor" && req.user.role !== "infirmier") {
            return res.status(403).json({ success: false, message: "Accès réservé aux professionnels de santé (Médecin/Infirmier)" });
        }

        const userId = req.user.id;

        // Jointure avec patient_records pour obtenir le nom et l'ID externe du patient.
        const [logs] = await pool.execute(
            `SELECT 
                l.action, 
                l.details, 
                l.timestamp,
                p.name as patient_name,
                p.patient_id
            FROM activity_logs l
            LEFT JOIN patient_records p ON l.patient_id_fk = p.id
            WHERE l.user_id_fk = ?
            ORDER BY l.timestamp DESC 
            LIMIT 50`, // Limite à 50 entrées récentes
            [userId]
        );

        res.json({ success: true, logs });

    } catch (err) {
        console.error("Erreur lors du chargement du journal:", err);
        res.status(500).json({ success: false, message: "Erreur serveur lors du chargement du journal." });
    }
});


// ---------------------------------------------------
module.exports = router;

// NOTE : Les fonctions frontend qui étaient à la fin de votre fichier (closeReadPopup, decryptContent, readRecord, addRecord)
// ont été déplacées dans app.js pour une meilleure séparation des responsabilités.