const crypto = require('crypto');
const NodeRSA = require('node-rsa');

// Chiffrement César
function cesarCipher(text, key, encrypt = true) {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char.match(/[a-z]/i)) {
      const code = text.charCodeAt(i);
      let shift = encrypt ? parseInt(key) : -parseInt(key);
      
      if (code >= 65 && code <= 90) {
        char = String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      } else if (code >= 97 && code <= 122) {
        char = String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
    }
    result += char;
  }
  return result;
}

// Chiffrement Vigenère
function vigenereCipher(text, key, encrypt = true) {
  let result = '';
  key = key.toUpperCase();
  let keyIndex = 0;
  
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char.match(/[a-z]/i)) {
      const code = text.charCodeAt(i);
      const keyChar = key[keyIndex % key.length];
      let shift = keyChar.charCodeAt(0) - 65;
      
      if (!encrypt) {
        shift = -shift;
      }
      
      if (code >= 65 && code <= 90) {
        char = String.fromCharCode(((code - 65 + shift + 26) % 26) + 65);
      } else if (code >= 97 && code <= 122) {
        char = String.fromCharCode(((code - 97 + shift + 26) % 26) + 97);
      }
      
      keyIndex++;
    }
    result += char;
  }
  return result;
}

// Configuration AES
const AES_KEY = crypto.randomBytes(32); // Clé 256 bits
const AES_IV = crypto.randomBytes(16);  // Vecteur d'initialisation

// Chiffrement AES
function aesEncrypt(text) {
  const cipher = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return AES_IV.toString('base64') + ':' + encrypted;
}

// Déchiffrement AES
function aesDecrypt(encryptedText) {
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'base64');
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Configuration RSA
let rsaKey = new NodeRSA({ b: 2048 });

function generateRSAKeyPair() {
  rsaKey = new NodeRSA({ b: 2048 });
  const publicKey = rsaKey.exportKey('public');
  const privateKey = rsaKey.exportKey('private');
  return { publicKey, privateKey };
}

function rsaEncrypt(text, publicKey = null) {
  let encryptKey = rsaKey;
  if (publicKey) {
    encryptKey = new NodeRSA();
    encryptKey.importKey(publicKey, 'public');
  }
  return encryptKey.encrypt(text, 'base64');
}

function rsaDecrypt(encryptedText, privateKey = null) {
  let decryptKey = rsaKey;
  if (privateKey) {
    decryptKey = new NodeRSA();
    decryptKey.importKey(privateKey, 'private');
  }
  return decryptKey.decrypt(encryptedText, 'utf8');
}

module.exports = {
  cesarCipher,
  vigenereCipher,
  aesEncrypt,
  aesDecrypt,
  generateRSAKeyPair,
  rsaEncrypt,
  rsaDecrypt
};