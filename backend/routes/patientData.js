const express = require('express');
const { authenticateToken } = require('./auth');
const { pool } = require('../database');
const router = express.Router();

// Récupérer les prescriptions du patient
router.get('/prescriptions', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est un patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux patients'
      });
    }

    const [prescriptions] = await pool.execute(
      `SELECT p.*, u.name as doctor_name 
       FROM prescriptions p 
       JOIN users u ON p.doctor_id = u.id 
       WHERE p.patient_id = ? 
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      prescriptions: prescriptions
    });

  } catch (error) {
    console.error('Error fetching prescriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des ordonnances'
    });
  }
});

// Récupérer les rendez-vous du patient
router.get('/appointments', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est un patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux patients'
      });
    }

    const [appointments] = await pool.execute(
      `SELECT a.*, u.name as doctor_name 
       FROM appointments a 
       JOIN users u ON a.doctor_id = u.id 
       WHERE a.patient_id = ? 
       ORDER BY a.appointment_date DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      appointments: appointments
    });

  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des rendez-vous'
    });
  }
});

// Récupérer les notes médicales du patient
router.get('/medical-notes', authenticateToken, async (req, res) => {
  try {
    // Vérifier si l'utilisateur est un patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Accès réservé aux patients'
      });
    }

    const [medicalNotes] = await pool.execute(
      `SELECT mn.*, u.name as doctor_name 
       FROM medical_notes mn 
       JOIN users u ON mn.doctor_id = u.id 
       WHERE mn.patient_id = ? 
       ORDER BY mn.visit_date DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      medicalNotes: medicalNotes
    });

  } catch (error) {
    console.error('Error fetching medical notes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des notes médicales'
    });
  }
});

// Récupérer la liste des médecins
router.get('/doctors', authenticateToken, async (req, res) => {
  try {
    const [doctors] = await pool.execute(
      'SELECT id, name, email FROM users WHERE role = "doctor"'
    );

    res.json({
      success: true,
      doctors: doctors
    });

  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des médecins'
    });
  }
});

module.exports = router;