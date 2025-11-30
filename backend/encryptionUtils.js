const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 16 octets pour AES

/**
 * Dérive une clé de 32 octets à partir de la phrase de passe fournie.
 * @param {string} passphrase 
 * @returns {Buffer} Clé de 32 octets
 */
function deriveKey(passphrase) {
    // Utilise SHA256 pour garantir une clé de 32 octets (256 bits)
    return crypto.createHash('sha256').update(passphrase).digest();
}

/**
 * Chiffre un buffer de fichier.
 * @param {Buffer} buffer - Le contenu du fichier.
 * @param {string} keyString - La clé de l'utilisateur.
 * @returns {Buffer} Le buffer chiffré (IV + données chiffrées).
 */
function encryptFile(buffer, keyString) {
    const key = deriveKey(keyString);
    const iv = crypto.randomBytes(IV_LENGTH); // IV aléatoire (nécessaire pour CBC)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);

    // Retourne l'IV suivi du contenu chiffré
    return Buffer.concat([iv, encrypted]);
}

/**
 * Déchiffre un buffer de fichier.
 * @param {Buffer} buffer - Le buffer chiffré (IV + données chiffrées).
 * @param {string} keyString - La clé de l'utilisateur.
 * @returns {Buffer} Le contenu du fichier déchiffré.
 */
function decryptFile(buffer, keyString) {
    const key = deriveKey(keyString);
    
    // Extrait l'IV (les 16 premiers octets) et le contenu chiffré
    const iv = buffer.slice(0, IV_LENGTH);
    const encryptedData = buffer.slice(IV_LENGTH);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

    return decrypted;
}

module.exports = {
    encryptFile,
    decryptFile
};