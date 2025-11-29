const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la base de données
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'medivault',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Créer un pool de connexions
const pool = mysql.createPool(dbConfig);

// Initialiser la base de données
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Créer la table users si elle n'existe pas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('doctor', 'patient') NOT NULL,
        phone VARCHAR(20),
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Créer la table patients si elle n'existe pas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS patients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        patient_id VARCHAR(50) UNIQUE NOT NULL,
        medical_record TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);
    
    // Créer la table prescriptions si elle n'existe pas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NOT NULL,
        medication TEXT NOT NULL,
        dosage VARCHAR(100),
        instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      )
    `);
    
    // Créer la table appointments si elle n'existe pas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NOT NULL,
        appointment_date DATETIME NOT NULL,
        notes TEXT,
        status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      )
    `);
    
    // Créer la table medical_notes si elle n'existe pas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS medical_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT NOT NULL,
        doctor_id INT NOT NULL,
        note TEXT NOT NULL,
        visit_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (doctor_id) REFERENCES users(id)
      )
    `);
    
    connection.release();
    console.log('✅ Base de données initialisée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur initialisation base de données:', error.message);
  }
}

module.exports = { pool, initializeDatabase };