// app.js (frontend) - MODIFIÉ AVEC JOURNAL D'ACTIVITÉ & AWS S3
const API_BASE_URL = 'http://localhost:5000/api';

// ----------------- AWS S3 CONFIGURATION (Placeholder Front-end) -----------------
const AWS_S3_BUCKET = 'medivault-pro-pdfs'; // Le nom de votre bucket S3
const AWS_REGION = 'eu-west-3'; // Votre région AWS

// NOTE: Les clés AWS ne doivent JAMAIS être exposées dans le code front-end (navigateur).
// Le backend est responsable de l'upload vers S3 en utilisant des identifiants sécurisés.
// ---------------------------------------------------------------------------------

let currentUser = null;
let authToken = null;
let currentSession = null;
let pendingEmail = null;
let currentEncryptedData = null; // Stocker temporairement les données chiffrées pour le popup de lecture

// ---------- Navigation / affichage ----------
function showAuthChoice() {
    const ids = ['authChoiceSection','loginSection','registerSection','emailVerifySection','mfaSection','doctorApp','patientApp','commonFeatures','userInfo'];
    ids.forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('authChoiceSection').classList.remove('hidden');
}
function showLoginForm() {
    document.getElementById('authChoiceSection').classList.add('hidden');
    document.getElementById('loginSection').classList.remove('hidden');
}
function showRegisterForm() {
    document.getElementById('authChoiceSection').classList.add('hidden');
    document.getElementById('registerSection').classList.remove('hidden');
}

// ---------- Inscription ----------
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

// ---------- Connexion + MFA ----------
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
        } else alert('Erreur connexion : ' + data.message);
    } catch (error) { alert('Erreur connexion : ' + error.message); }
});

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
        } else alert('Code MFA incorrect');
    } catch (error) { alert('Erreur MFA : ' + error.message); }
}

// ---------- Affichage selon rôle ----------
function showAppBasedOnRole() {
    ['mfaSection','emailVerifySection', 'loginSection', 'registerSection', 'authChoiceSection'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById('userInfo').classList.remove('hidden');
    document.getElementById('commonFeatures').classList.remove('hidden');

    document.getElementById('userEmail').textContent = currentUser.email;
    document.getElementById('userRole').textContent = currentUser.role === 'doctor' ? 'Médecin' : 'infirmier(ère)';

    if (currentUser.role === 'doctor') {
        document.getElementById('doctorApp').classList.remove('hidden');
        document.getElementById('patientApp').classList.add('hidden');
        document.getElementById('doctorName').textContent = currentUser.name;
        loadPatients();
        loadKeyVault(); 
        loadActivityLog(); // NOUVEAU: Charger le journal d'activité
    } else {
        document.getElementById('doctorApp').classList.add('hidden');
        document.getElementById('patientApp').classList.remove('hidden');
        document.getElementById('patientName').textContent = currentUser.name;
        loadPatientData();
    }
}

// ---------- Fonctions de chiffrement côté frontend ----------
function cesarEncrypt(text, key = 3) {
    key = parseInt(key) || 3; 
    return text.replace(/[a-z]/gi, c =>
        String.fromCharCode(
            (c.toLowerCase().charCodeAt(0) - 97 + key) % 26 + 97
        )
    );
}
function vigenereEncrypt(text, key) {
    key = (key || "CLE").toLowerCase(); 
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
        } else result += c;
    }
    return result;
}
function aesEncrypt(text) {
    return btoa(text); 
}

// NOUVEAU: Fonction de chiffrement RSA (Placeholder simple)
function rsaEncrypt(text, publicKey) {
    // ATTENTION: Le chiffrement RSA complet côté client est complexe et 
    // nécessiterait une librairie (ex: jsencrypt) pour le vrai chiffrement asymétrique.
    // Cette version est un PLACHOLDER utilisant Base64.
    if (!publicKey) {
        console.warn("Clé publique RSA manquante. Chiffrement par défaut (Base64) utilisé.");
    }
    // Ajout d'un suffixe pour le distinguer des autres encodages Base64
    return btoa(text) + (publicKey ? '_RSA_ENCRYPTED' : '_RSA_DEFAULT');
}

// ----------------- Gestion du Popup Ajout Dossier -----------------

function openAddRecordPopup() {
    document.getElementById("addRecordPopup").classList.remove("hidden");
    document.getElementById('addPatientForm').reset(); // Nettoyer le formulaire à l'ouverture
}

function closeAddRecordPopup() {
    document.getElementById("addRecordPopup").classList.add("hidden");
}


async function submitNewPatient(name, patientId, medicalRecord, encryption, encryptionKey, pdfFile) {
    try {
        if (!authToken) {
            alert("Erreur: Vous n'êtes pas connecté. Veuillez vous reconnecter.");
            logout();
            return;
        }

        let encRecord = medicalRecord || "";
        
        // Chiffrement côté frontend selon l'algorithme choisi
        if (encryption === 'cesar') encRecord = cesarEncrypt(encRecord, encryptionKey);
        if (encryption === 'vigenere') encRecord = vigenereEncrypt(encRecord, encryptionKey);
        if (encryption === 'aes') encRecord = aesEncrypt(encRecord); 
        if (encryption === 'rsa') encRecord = rsaEncrypt(encRecord, encryptionKey);

        const formData = new FormData();
        formData.append('name', name);
        formData.append('patientId', patientId);
        formData.append('medicalRecord', encRecord);
        formData.append('encryption', encryption || 'none');
        if (encryptionKey) formData.append('encryptionKey', encryptionKey);
        
        // --- AWS S3 INTEGRATION LOGIC (Managed by Backend) ---
        if (pdfFile) {
            // Le fichier PDF est envoyé au backend. Le backend est responsable de :
            // 1. Recevoir le fichier (via Multer ou similaire).
            // 2. Le téléverser vers le bucket AWS S3 spécifié (ex: AWS_S3_BUCKET).
            // 3. Stocker l'URL S3 retournée dans la base de données.
            console.log(`Le backend gère l'upload de ${pdfFile.name} vers S3 dans la région ${AWS_REGION}.`);
            formData.append('pdfFile', pdfFile); // On continue d'envoyer le fichier au backend
        }
        // ----------------------------------------------------

        const resp = await fetch(`${API_BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData
        });

        const data = await resp.json();
        if (!data.success) return alert("Erreur ajout dossier : " + data.message);
        
        // Sauvegarder automatiquement la clé si elle est chiffrée
        if (encryption !== 'none' && encryptionKey) {
            try {
                // Nom de la clé basé sur l'ID du patient et le type d'algo (ex: P123_cesar)
                const keyName = `${patientId}_${encryption}`;
                await fetch(`${API_BASE_URL}/patients/keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    // key_value est la valeur réelle de la clé pour le stockage
                    body: JSON.stringify({ name: keyName, algorithm: encryption, key_value: encryptionKey })
                });
            } catch (err) {
                console.error("Erreur lors de la sauvegarde automatique de la clé:", err);
            }
        }

        alert("Dossier ajouté !");
        
        loadPatients(); 
        loadKeyVault(); // Recharger le vault pour afficher la nouvelle clé
        loadActivityLog(); // NOUVEAU: Mettre à jour le journal d'activité

    } catch (err) {
        alert("Erreur ajout dossier: " + err.message);
    }
}

// ---------- Gestion patients (médecin et infirmier) ----------
function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

async function handleDecrypt(encryptedData) {
    const keyInput = document.getElementById("recordKeyInput");
    const errorBox = document.getElementById("recordKeyError");
    const contentDiv = document.getElementById("recordContent");
    // NOUVEAU: Récupération du conteneur PDF
    const pdfContainer = document.getElementById("pdfContainer"); 
    const key = keyInput.value.trim();

    errorBox.classList.add("hidden");
    contentDiv.classList.add("hidden");
    if (pdfContainer) pdfContainer.classList.add("hidden"); // Cache le conteneur PDF par défaut

    if (!key) {
        errorBox.classList.remove("hidden");
        errorBox.textContent = "Veuillez entrer une clé.";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/patients/read/${encryptedData.id}?key=${encodeURIComponent(key)}`, {
             headers: { "Authorization": `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.success && data.record) {
            contentDiv.innerText = data.record; 
            contentDiv.classList.remove("hidden");
            errorBox.classList.add("hidden");
            loadActivityLog(); 

            // FIX: Afficher le lien PDF si un chemin existe dans le dossier initial
            if (encryptedData.pdf_path && pdfContainer) {
                // Le lien ci-dessous devrait maintenant pointer vers l'endpoint qui gère le téléchargement depuis S3
                pdfContainer.innerHTML = `
                    <p>Document PDF associé (sécurisé, S3):</p>
                    <a href="${API_BASE_URL}/patients/pdf/${encryptedData.id}" target="_blank" class="btn secondary" style="display: block; text-align: center; margin-top: 10px;">
                        🔗 Voir/Télécharger le PDF
                    </a>
                `;
                pdfContainer.classList.remove("hidden");
            }
            // FIN FIX

        } else {
            errorBox.textContent = data.message || "Clé incorrecte ou erreur de déchiffrement.";
            errorBox.classList.remove("hidden");
        }
    } catch (err) {
        errorBox.textContent = "Erreur lors du déchiffrement.";
        errorBox.classList.remove("hidden");
    }
}

async function readRecord(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/patients/read/${id}`, {
            headers: { "Authorization": `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!data.success) {
            alert(data.message);
            return;
        }

        document.getElementById("readPopup").classList.remove("hidden");

        const keyInput = document.getElementById("recordKeyInput");
        const validateBtn = document.getElementById("validateRecordKeyBtn");
        const errorBox = document.getElementById("recordKeyError");
        const contentDiv = document.getElementById("recordContent");
        const pdfContainer = document.getElementById("pdfContainer"); // Ajouté pour s'assurer qu'il est réinitialisé

        keyInput.value = "";
        errorBox.classList.add("hidden");
        contentDiv.classList.add("hidden");
        if (pdfContainer) pdfContainer.classList.add("hidden"); // Cacher le PDF à l'ouverture
        contentDiv.innerText = "";
        
        currentEncryptedData = { id: id, ...data }; 

        validateBtn.onclick = () => handleDecrypt(currentEncryptedData);
        keyInput.onkeydown = (e) => {
            if (e.key === 'Enter') handleDecrypt(currentEncryptedData);
        };

    } catch (err) {
        alert("Erreur lors de la lecture du dossier.");
    }
}

function closeReadPopup() {
    document.getElementById('readPopup').classList.add("hidden");
    document.getElementById("recordContent").classList.add("hidden");
    // NOUVEAU: Cacher le conteneur PDF
    const pdfContainer = document.getElementById("pdfContainer"); 
    if (pdfContainer) pdfContainer.classList.add("hidden");
    // FIN NOUVEAU
    document.getElementById("recordKeyError").classList.add("hidden");
    document.getElementById("recordKeyInput").value = "";
    currentEncryptedData = null;
    
    const validateBtn = document.getElementById("validateRecordKeyBtn");
    if (validateBtn) validateBtn.onclick = null; 
    const keyInput = document.getElementById("recordKeyInput");
    if (keyInput) keyInput.onkeydown = null;
}


async function editRecord(id) {
    try {
        const head = await fetch(`${API_BASE_URL}/patients/read/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        let data = await head.json();
        if (!data.success) return alert(data.message);

        let currentText = data.record || "";
        let keyForUse = null;

        if (data.encryption_algorithm && data.encryption_algorithm !== 'none' && !data.encryption_key_stored) {
            keyForUse = prompt(`Dossier chiffré (${data.encryption_algorithm}). Entrez la clé pour déchiffrer :`);
            if (keyForUse === null) return;
            
            const r2 = await fetch(`${API_BASE_URL}/patients/read/${id}?key=${encodeURIComponent(keyForUse)}`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const d2 = await r2.json();
            if (!d2.success) return alert("Clé invalide : " + d2.message);
            currentText = d2.record;
        }

        const newText = prompt("Modifier la note médicale :", currentText);
        if (newText === null) return;

        let newKey = keyForUse;
        if (data.encryption_algorithm && data.encryption_algorithm !== 'none') {
            const ask = confirm("Voulez-vous fournir une clé pour rechiffrement / la stocker ? (OK = oui)");
            if (ask) {
                newKey = prompt("Entrez la clé à utiliser pour rechiffrement (laissez vide pour réutiliser la même) :", newKey || "");
                if (newKey === null) newKey = undefined;
            }
        }

        const resp = await fetch(`${API_BASE_URL}/patients/edit/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ newText, key: newKey })
        });

        const d = await resp.json();
        if (!d.success) return alert("Erreur modification : " + d.message);
        alert("Dossier modifié !");
        loadPatients();
        // NOUVEAU: Recharger pour l'infirmier aussi si nécessaire
        if (currentUser && currentUser.role !== 'doctor') loadPatientRecords(); 
        loadActivityLog(); // NOUVEAU: Mettre à jour le journal après modification

    } catch (err) {
        alert("Erreur modification : " + err.message);
    }
}

async function deleteRecord(id) {
    try {
        if (!confirm("Supprimer ce dossier ?")) return;
        const resp = await fetch(`${API_BASE_URL}/patients/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const d = await resp.json();
        if (!d.success) return alert("Erreur suppression : " + d.message);
        alert("Dossier supprimé");
        loadPatients();
        // NOUVEAU: Recharger pour l'infirmier aussi si nécessaire
        if (currentUser && currentUser.role !== 'doctor') loadPatientRecords(); 
        loadActivityLog(); // NOUVEAU: Mettre à jour le journal après suppression
    } catch (err) {
        alert("Erreur suppression : " + err.message);
    }
}

async function loadPatients() {
    const patientsList = document.getElementById('patientsList');
    // Vérifier si l'élément du médecin est présent
    if (!patientsList) return; 
    // Appeler la fonction générique avec l'ID spécifique au médecin
    await loadPatientRecords('patientsList');
}

/**
 * Fonction générique pour charger et afficher les dossiers patients.
 * @param {string} targetElementId L'ID du conteneur HTML où afficher la liste.
 */
async function loadPatientRecords(targetElementId = 'patientRecordsList') {
    try {
        const response = await fetch(`${API_BASE_URL}/patients`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();

        const listContainer = document.getElementById(targetElementId);
        if (!listContainer) return;

        // Mise à jour du titre si c'est la liste de l'infirmier
        listContainer.innerHTML = targetElementId === 'patientsList' ? 
            '<h4>Dossiers Patients:</h4>' : '<h4>Dossiers enregistrés:</h4>';

        if (!data.success || data.count === 0) {
            listContainer.innerHTML += "<p>Aucun dossier</p>";
            return;
        }

        data.patients.forEach(patient => {
            const div = document.createElement('div');
            div.className = 'patient-record';
            
            const pdfDownload = patient.pdf_url ? 
                `<span>📄 PDF (Securisé/S3)</span>` : ''; 

            div.innerHTML = `
                <strong>${escapeHtml(patient.name)}</strong> (ID: ${escapeHtml(patient.patient_id)})<br>
                <small>Créé le: ${new Date(patient.created_at).toLocaleString()}</small>
                <p><strong>Chiffrement :</strong> ${patient.encryption_algorithm} ${patient.encryption_key ? '(clé stockée)' : ''}</p>
                ${pdfDownload}
                <button data-id="${patient.id}" class="btn-read">🔓 Lire</button>
                <button data-id="${patient.id}" class="btn-edit">✏️ Modifier</button>
                <button data-id="${patient.id}" class="btn-delete">🗑️ Supprimer</button>
                <hr>
            `;
            listContainer.appendChild(div);
        });

        // Attribution des écouteurs d'événements
        listContainer.querySelectorAll('.btn-read').forEach(b => b.onclick = (e) => readRecord(e.currentTarget.dataset.id));
        listContainer.querySelectorAll('.btn-edit').forEach(b => b.onclick = (e) => editRecord(e.currentTarget.dataset.id));
        listContainer.querySelectorAll('.btn-delete').forEach(b => b.onclick = (e) => deleteRecord(e.currentTarget.dataset.id));

    } catch (error) {
        console.error(error);
        alert("Erreur chargement dossiers : " + error.message);
    }
}


// ----------------- FONCTION JOURNAL D'ACTIVITÉ (NOUVEAU) -----------------
async function loadActivityLog() {
    // Assurez-vous d'avoir un élément avec l'ID 'activityLogList' dans votre HTML
    const logList = document.getElementById('activityLogList');
    if (!logList) return; 

    logList.innerHTML = '<p>Chargement du journal d\'activité...</p>';

    try {
        const resp = await fetch(`${API_BASE_URL}/patients/logs`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const d = await resp.json();
        
        if (!d.success) throw new Error(d.message || "Erreur API lors du chargement du journal.");

        let htmlContent = ''; 

        if (!d.logs || d.logs.length === 0) { 
            htmlContent += '<p class="no-data">Aucune activité récente enregistrée.</p>'; 
        } else {
            d.logs.forEach(log => {
                const date = new Date(log.timestamp).toLocaleString();
                let details = escapeHtml(log.details);
                
                // Afficher les détails du patient si disponibles
                if (log.patient_name) {
                    details += ` (Dossier: ${escapeHtml(log.patient_name)} - ID: ${escapeHtml(log.patient_id)})`;
                }
                
                htmlContent += `
                    <div class="log-entry">
                        <small><strong>${date}</strong></small>
                        <p><strong>${escapeHtml(log.action)}:</strong> ${details}</p>
                    </div>
                `;
            });
        }
        logList.innerHTML = htmlContent;

    } catch (err) { 
        console.error("Erreur chargement Journal d'Activité:", err);
        logList.innerHTML = '<p class="error">❌ Erreur lors du chargement du journal.</p>';
    }
}
// ----------------- FIN JOURNAL D'ACTIVITÉ -----------------


// ---------- Key Vault (UI minimal) ----------
async function loadKeyVault() {
    // Cibler le nouveau conteneur de contenu, pas la section entière
    const kvContent = document.getElementById('keyVaultContentList');
    if (!kvContent) return;

    // Afficher un message de chargement initial
    kvContent.innerHTML = '<p>Chargement des clés...</p>';
    
    try {
        const resp = await fetch(`${API_BASE_URL}/patients/keys`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const d = await resp.json();
        if (!d.success) throw new Error(d.message || "Erreur API lors du chargement des clés.");
        
        let htmlContent = ''; 

        if (!d.keys || d.keys.length === 0) { 
            htmlContent += '<p>Aucune clé enregistrée automatiquement.</p>'; 
        } else {
            d.keys.forEach(k => {
                // Masquer le nom de la clé et garder le format simple demandé
                htmlContent += `<div><strong>***</strong> - ${escapeHtml(k.algorithm)} - créé: ${new Date(k.created_at).toLocaleString()}</div>`;
            });
        }
        kvContent.innerHTML = htmlContent;

    } catch (err) { 
        console.error("Erreur chargement Key Vault:", err);
        // Afficher un message d'erreur dans la zone de contenu
        kvContent.innerHTML = '<p style="color:red;">❌ Erreur lors du chargement des clés.</p>';
    }
}


// ---------- Données patient (si role patient/infirmier) ----------
async function loadPatientData() {
    await loadPatientRecords(); // NOUVEAU: Charge les dossiers patients
}

// Les fonctions de chargement des autres données sont nettoyées car elles n'ont pas d'implémentation
// async function loadPrescriptions() { document.getElementById('prescriptionsList').innerHTML = '<p>Liste des ordonnances (API non implémentée)</p>'; }
// async function loadDoctors() { document.getElementById('doctorsList').innerHTML = '<p>Liste des médecins (API non implémentée)</p>'; }
// async function loadAppointments() { document.getElementById('appointmentsList').innerHTML = '<p>Liste des RDV (API non implémentée)</p>'; }
// async function loadMedicalNotes() { document.getElementById('medicalNotesList').innerHTML = '<p>Liste des notes (API non implémentée)</p>'; }

// ---------- Déconnexion ----------
function logout() {
    currentUser = null; authToken = null; currentSession = null; pendingEmail = null;
    ['doctorApp','patientApp','commonFeatures','userInfo', 'readPopup', 'addRecordPopup'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.classList.add('hidden');
    });
    showAuthChoice();
    try { 
        document.getElementById('loginForm').reset(); 
        document.getElementById('registerForm').reset(); 
    } catch(e){}
}

// ---------- Initialisation ----------
document.addEventListener('DOMContentLoaded', function() {
    showAuthChoice();
    
    // Écouteur de soumission du formulaire du popup d'ajout de dossier
    const addPatientForm = document.getElementById('addPatientForm');
    if (addPatientForm) {
        addPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = document.getElementById('addName').value;
            const patientId = document.getElementById('addPatientId').value;
            const medicalRecord = document.getElementById('addMedicalRecord').value;
            const encryption = document.getElementById('addEncryptionType').value;
            const encryptionKey = document.getElementById('addEncryptionKey').value.trim() || null;
            const pdfFile = document.getElementById('addPdfFile').files[0];

            await submitNewPatient(name, patientId, medicalRecord, encryption, encryptionKey, pdfFile);
            
            closeAddRecordPopup();
        });
    }

    // Écouteur pour le bouton d'ouverture du popup d'ajout
    const openAddPatientBtn = document.querySelector('#doctorApp .patient-form button');
    if (openAddPatientBtn) {
        openAddPatientBtn.onclick = openAddRecordPopup;
    }
    
    // L'écouteur pour la validation du code email
    const verifyEmailBtn = document.querySelector('#emailVerifySection button');
    if (verifyEmailBtn) verifyEmailBtn.onclick = verifyEmail;

    // L'écouteur pour la validation du code MFA
    const verifyMfaBtn = document.querySelector('#mfaSection button');
    if (verifyMfaBtn) verifyMfaBtn.onclick = verifyMFA;

    // L'écouteur pour le bouton de déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = logout;

    // L'écouteur pour la validation de la clé dans le popup de lecture
    const validateKeyBtn = document.getElementById('validateRecordKeyBtn');
    if (validateKeyBtn) validateKeyBtn.onclick = null; // Sera défini dans readRecord
    
    window.resendVerificationCode = () => alert("Renvoyer le code... (API non implémentée)");
});