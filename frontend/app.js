// ==========================================
// CONFIGURATION
// ==========================================
const API_BASE_URL = 'http://localhost:5000/api';

let currentUser = null;
let authToken = null;
let currentSession = null;
let pendingEmail = null;


// ==========================================
// NAVIGATION AUTHENTIFICATION
// ==========================================

function showAuthChoice() {
    document.getElementById('authChoiceSection').classList.remove('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('registerSection').classList.add('hidden');
    document.getElementById('emailVerifySection').classList.add('hidden');
    document.getElementById('mfaSection').classList.add('hidden');
    document.getElementById('doctorApp').classList.add('hidden');
    document.getElementById('patientApp').classList.add('hidden');
    document.getElementById('commonFeatures').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');
}

function showLoginForm() {
    document.getElementById('authChoiceSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('registerSection').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('authChoiceSection').classList.add('hidden');
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('registerSection').classList.remove('hidden');
}


// ==========================================
// INSCRIPTION
// ==========================================

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const role = document.getElementById('registerRole').value;
    const phone = document.getElementById('registerPhone').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password, name, phone, role })
        });

        const data = await response.json();

        if (data.success) {
            currentSession = data.session;
            pendingEmail = email;
            document.getElementById('registerSection').classList.add('hidden');
            document.getElementById('emailVerifySection').classList.remove('hidden');
            document.getElementById('verifyEmail').textContent = email;
        } else {
            alert('Erreur inscription : ' + data.message);
        }
    } catch (error) {
        alert('Erreur : ' + error.message);
    }
});

// Vérification email
async function verifyEmail() {
    const code = document.getElementById('emailVerifyCode').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ session: currentSession, code })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            authToken = data.token;
            showAppBasedOnRole();
        } else {
            alert('Code incorrect : ' + data.message);
        }
    } catch (error) {
        alert('Erreur : ' + error.message);
    }
}


// ==========================================
// CONNEXION + MFA
// ==========================================

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const role = document.getElementById('loginRole').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, password, role })
        });

        const data = await response.json();
        if (data.success) {
            currentSession = data.session;
            document.getElementById('loginSection').classList.add('hidden');
            document.getElementById('mfaSection').classList.remove('hidden');
        } else {
            alert('Erreur connexion : ' + data.message);
        }
    } catch (error) {
        alert('Erreur connexion : ' + error.message);
    }
});

// Vérification MFA
async function verifyMFA() {
    const code = document.getElementById('mfaCode').value;

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-mfa`, {

            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ session: currentSession, code })
        });

        const data = await response.json();

        if (data.success) {
            currentUser = data.user;
            authToken = data.token;
            showAppBasedOnRole();
        } else {
            alert('Code MFA incorrect');
        }
    } catch (error) {
        alert('Erreur MFA : ' + error.message);
    }
}


// ==========================================
// AFFICHAGE SELON RÔLE
// ==========================================

function showAppBasedOnRole() {
    document.getElementById('mfaSection').classList.add('hidden');
    document.getElementById('emailVerifySection').classList.add('hidden');
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('commonFeatures').classList.remove('hidden');

    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role === 'doctor' ? 'Médecin' : 'Patient';

    if (currentUser.role === 'doctor') {
        document.getElementById('doctorApp').classList.remove('hidden');
        document.getElementById('patientApp').classList.add('hidden');
        document.getElementById('doctorName').textContent = currentUser.name;
        loadPatients();
    } else {
        document.getElementById('doctorApp').classList.add('hidden');
        document.getElementById('patientApp').classList.remove('hidden');
        document.getElementById('patientName').textContent = currentUser.name;
        loadPatientData();
    }
}


// ==========================================
// AJOUT DOSSIER — POPUP CHIFFREMENT
// ==========================================

function openPopup() {
    document.getElementById('encryptionPopup').classList.remove('hidden');
}

function closePopup() {
    document.getElementById('encryptionPopup').classList.add('hidden');
}

// Fonctions de chiffrement AVANT envoi
function cesarEncrypt(text, key = 3) {
    return text.replace(/[a-z]/gi, c =>
        String.fromCharCode(
            (c.toLowerCase().charCodeAt(0) - 97 + parseInt(key)) % 26 + 97
        )
    );
}

function vigenereEncrypt(text, key) {
    key = key.toLowerCase();
    let result = "";
    let j = 0;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (/[a-z]/i.test(c)) {
            let shift = key[j % key.length].charCodeAt(0) - 97;
            let encrypted = String.fromCharCode(
                ((c.toLowerCase().charCodeAt(0) - 97 + shift) % 26) + 97
            );
            result += encrypted;
            j++;
        } else {
            result += c;
        }
    }
    return result;
}

function aesEncrypt(text) {
    return btoa(text); // AES simulé côté frontend
}


// Validation popup : chiffrer + envoyer au backend
async function confirmEncryption() {
    const type = document.getElementById("encryptionType").value;
    const key = document.getElementById("encryptionKey").value;

    const name = document.getElementById("patientName").value;
    const patientId = document.getElementById("patientId").value;
    const medicalRecord = document.getElementById("medicalRecord").value;
    const pdfFile = document.getElementById("pdfFile").files[0];

    let encryptedRecord = "";
    switch (type) {
        case "cesar": encryptedRecord = cesarEncrypt(medicalRecord, key || 3); break;
        case "vigenere": encryptedRecord = vigenereEncrypt(medicalRecord, key || "CLE"); break;
        case "aes": encryptedRecord = aesEncrypt(medicalRecord); break;
        default: encryptedRecord = medicalRecord;
    }

    const formData = new FormData();
    formData.append("name", name);
    formData.append("patientId", patientId);
    formData.append("medicalRecord", encryptedRecord);
    formData.append("encryption", type);
    if (pdfFile) formData.append("pdfFile", pdfFile);

    const response = await fetch(`${API_BASE_URL}/patients`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${authToken}` },
        body: formData
    });

    const data = await response.json();
    if (data.success) {
        closePopup();
        loadPatients();
        alert("Dossier chiffré + PDF ajouté !");
    } else alert("Erreur : " + data.message);
}



// ==========================================
// GESTION PATIENTS (Médecin)
// ==========================================

// Échapper le HTML
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Lire / déchiffrer
async function readRecord(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/patients/read/${id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!data.success) {
            return alert(data.message);
        }

        // Afficher les notes dans popup
        document.getElementById("recordContent").textContent = data.record;
        document.getElementById("readPopup").classList.remove("hidden");

    } catch (error) {
        alert("Erreur lecture : " + error.message);
    }
}


function closeReadPopup() {
    document.getElementById("readPopup").classList.add("hidden");
}

// Modifier avec re-chiffrement automatique côté backend
async function editRecord(id) {
    try {
        const resp = await fetch(`${API_BASE_URL}/patients/read/${id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });
        const data = await resp.json();

        if (!data.success) {
            alert("Impossible de charger le dossier : " + data.message);
            return;
        }

        const newText = prompt("Modifier la note médicale :", data.record);
        if (newText === null) return;

        const resp2 = await fetch(`${API_BASE_URL}/patients/edit/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ newText })
        });

        const d2 = await resp2.json();
        if (!d2.success) {
            alert("Erreur modification : " + d2.message);
            return;
        }

        alert("Dossier modifié !");
        loadPatients();

    } catch (error) {
        alert("Erreur modification : " + error.message);
    }
}

// Supprimer
async function deleteRecord(id) {
    try {
        if (!confirm("Supprimer ce dossier ?")) return;

        const resp = await fetch(`${API_BASE_URL}/patients/${id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        const data = await resp.json();
        if (!data.success) {
            alert("Erreur suppression : " + data.message);
            return;
        }

        alert("Dossier supprimé");
        loadPatients();

    } catch (error) {
        alert("Erreur suppression :" + error.message);
    }
}

// Charger dossiers
async function loadPatients() {
    try {
        const response = await fetch(`${API_BASE_URL}/patients`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        const data = await response.json();

        const patientsList = document.getElementById('patientsList');
        patientsList.innerHTML = '<h4>Dossiers Patients:</h4>';

        if (!data.success || data.count === 0) {
            patientsList.innerHTML += "<p>Aucun dossier</p>";
            return;
        }

        data.patients.forEach(patient => {
            const div = document.createElement('div');
            div.className = 'patient-record';

            div.innerHTML = `
                <strong>${escapeHtml(patient.name)}</strong> (ID: ${escapeHtml(patient.patient_id)})<br>
                <small>Créé le: ${new Date(patient.created_at).toLocaleString()}</small>
                <p><strong>Chiffrement :</strong> ${patient.encryption_algorithm}</p>
                <button onclick="readRecord(${patient.id})">🔓 Lire</button>
                <button onclick="editRecord(${patient.id})">✏️ Modifier</button>
                <button onclick="deleteRecord(${patient.id})">🗑️ Supprimer</button>
                <hr>
            `;
            patientsList.appendChild(div);
        });

    } catch (error) {
        console.error(error);
    }
}


// ==========================================
// DONNÉES PATIENT (si role patient)
// ==========================================

async function loadPatientData() {
    await loadPrescriptions();
    await loadDoctors();
    await loadAppointments();
    await loadMedicalNotes();
}

async function loadPrescriptions() { /* ... inchangé ... */ }
async function loadDoctors() { /* ... inchangé ... */ }
async function loadAppointments() { /* ... inchangé ... */ }
async function loadMedicalNotes() { /* ... inchangé ... */ }


// ==========================================
// DÉCONNEXION
// ==========================================
function logout() {
    currentUser = null;
    authToken = null;
    currentSession = null;
    pendingEmail = null;

    document.getElementById('doctorApp').classList.add('hidden');
    document.getElementById('patientApp').classList.add('hidden');
    document.getElementById('commonFeatures').classList.add('hidden');
    document.getElementById('userInfo').classList.add('hidden');

    showAuthChoice();
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
}

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    showAuthChoice();
});
