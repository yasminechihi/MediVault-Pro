const keyVaultSecrets = new Map();

// Stocker un secret
async function storeSecretInVault(name, value) {
  const version = Date.now().toString();
  keyVaultSecrets.set(`${name}-${version}`, {
    value: value,
    created: new Date().toISOString()
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  return version;
}

// Récupérer un secret
async function retrieveSecretFromVault(name, version = null) {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  if (version) {
    const secret = keyVaultSecrets.get(`${name}-${version}`);
    return secret ? secret.value : null;
  }
  
  const versions = Array.from(keyVaultSecrets.keys())
    .filter(key => key.startsWith(name))
    .sort()
    .reverse();
  
  if (versions.length === 0) return null;
  
  return keyVaultSecrets.get(versions[0]).value;
}

// Supprimer un secret
async function deleteSecretFromVault(name) {
  const versions = Array.from(keyVaultSecrets.keys())
    .filter(key => key.startsWith(name));
  
  versions.forEach(version => {
    keyVaultSecrets.delete(version);
  });
  
  await new Promise(resolve => setTimeout(resolve, 50));
  return true;
}

// Lister tous les secrets (pour l'interface Key Vault)
async function listSecrets() {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const secrets = [];
  keyVaultSecrets.forEach((value, key) => {
    const [name, version] = key.split('-');
    secrets.push({
      name: name,
      version: version,
      value: value.value,
      created: value.created
    });
  });
  
  return secrets;
}

module.exports = {
  storeSecretInVault,
  retrieveSecretFromVault,
  deleteSecretFromVault,
  listSecrets
};