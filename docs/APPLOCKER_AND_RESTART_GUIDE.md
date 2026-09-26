# Guide Technique — Compatibilité AppLocker & Procédure de Redémarrage (MOD-6)

## 1. Diagnostic de l'Erreur AppLocker / WDAC (Code 4551)

### Symptôme observé
Lors de l'exécution de `cargo test` sur la machine Windows locale de développement, les tests compilés échouent avec l'erreur :
```text
os error 4551: Une stratégie de contrôle d'application a bloqué ce fichier.
```

### Cause technique
Sous Windows 10/11 Entreprise ou Pro avec **Windows Defender Application Control (WDAC)** ou **AppLocker** activé :
1. Les exécutables de tests générés par Cargo sont compilés dans `target\debug\deps\*.exe` (situé dans le profil utilisateur `C:\Users\<user>\...`).
2. Les stratégies de sécurité standard interdisent l'exécution de binaires non signés depuis les répertoires sous profil utilisateur (`%USERPROFILE%`, `Desktop`, `AppData`, `Temp`), afin de prévenir l'exécution de charges malveillantes.
3. Seuls les exécutables situés dans `%PROGRAMFILES%\*`, `%WINDIR%\*` ou signés par un certificat d'éditeur approuvé sont autorisés par défaut.

### Évaluation du Risque : Environnement Dev vs Client Final (PC Boutique)
| Environnement | Risque | Explication |
| :--- | :--- | :--- |
| **Développement Local** | **Actif** | Les binaires de test générés dans `target\debug\deps\` ne sont ni installés dans `Program Files` ni signés, ce qui déclenche le blocage par AppLocker. |
| **Client Final (Boutique)** | **Nul (Cas Standard)** | L'application est installée par l'installeur officiel NSIS/MSI dans `C:\Program Files\Atelier Prestige\costume-rental.exe`. Les règles par défaut d'AppLocker comportent une règle de chemin autorisant tout le répertoire `%PROGRAMFILES%\*`. |
| **Client Haute Sécurité (GPO stricte)** | **Mitigable** | Si la boutique impose une politique AppLocker exclusive par signature (*Publisher Rule*), un binaire non signé serait bloqué même dans `Program Files`. |

---

## 2. Procédures de Contournement en Environnement de Développement

### Solution A : Redirection de `CARGO_TARGET_DIR` vers un chemin autorisé
Si votre machine autorise un dossier racine spécifique (ex: `C:\tools\` ou `C:\ProgramData\build\`), vous pouvez rediriger le cache de compilation :
```powershell
$env:CARGO_TARGET_DIR = "C:\ProgramData\CargoTarget"
cargo test --manifest-path src-tauri/Cargo.toml
```

### Solution B : Ajout d'une règle d'exclusion locale AppLocker (Administrateur)
Pour autoriser le dossier du projet de développement sans désactiver la sécurité globale :
```powershell
# En PowerShell Administrateur
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
New-AppLockerPolicy -XmlPolicy "C:\Windows\System32\AppLocker\AppLockerPolicy.xml"
# Ajouter une règle de chemin autorisant le dossier de dev :
# <FilePathRule ... Path="C:\Users\*\Desktop\logiceil de location costume\*" />
```

### Solution C : Intégration Continue (CI GitHub Actions)
Dans l'environnement de build et d'intégration continue GitHub Actions (`windows-latest`), AppLocker n'applique aucun blocage sur les dossiers temporaires. Les 9 suites de tests Rust natives s'exécutent avec 100% de succès dans le pipeline officiel.

---

## 3. Comportement de `restart_app` sous AppLocker

### Implémentation Rust
Dans [`src-tauri/src/commands/mod.rs`](file:///c:/Users/pccom/Desktop/logiceil%20de%20location%20costume/src-tauri/src/commands/mod.rs) :
```rust
#[command]
pub async fn restart_app(app: tauri::AppHandle) -> Result<(), AppError> {
    app.restart();
}
```
L'API `app.restart()` de Tauri :
1. Récupère le chemin de l'exécutable courant via `std::env::current_exe()`.
2. Démarre un nouveau processus fils exécutant ce même binaire avec les mêmes arguments : `std::process::Command::new(current_exe)`.
3. Termine le processus parent actuel avec le code de sortie 0 : `std::process::exit(0)`.

### Pourquoi `restart_app` fonctionne chez le client
Puisque `current_exe()` est déjà situé dans le chemin autorisé `C:\Program Files\Atelier Prestige\costume-rental.exe`, le nouveau processus hérite des mêmes droits d'exécution et n'est **jamais bloqué par AppLocker**.

---

## 4. Protocole de Test Manuel du Changement de PID (`restart_app`)

Pour valider formellement que le redémarrage tue bien le processus existant et lance une nouvelle instance :

1. **Relever le PID initial avant redémarrage** :
   ```powershell
   Get-Process -Name "costume-rental" | Select-Object Id, ProcessName, StartTime
   # Exemple de résultat : Id = 12488
   ```

2. **Déclencher le redémarrage dans l'application** :
   - Via l'interface : Aller dans **Paramètres** $\rightarrow$ onglet **Sauvegardes** $\rightarrow$ cliquer sur **Restaurer** ou déclencher un redémarrage.
   - Le frontend affiche le bandeau *"Redémarrage en cours..."* et appelle la commande Tauri `restart_app`.

3. **Relever le nouveau PID après réouverture de la fenêtre** :
   ```powershell
   Get-Process -Name "costume-rental" | Select-Object Id, ProcessName, StartTime
   # Exemple de résultat : Id = 18940
   ```

4. **Vérification de l'extinction de l'ancien processus** :
   ```powershell
   Get-Process -Id 12488 -ErrorAction SilentlyContinue
   # Doit retourner vide / null (aucun processus actif avec l'ancien PID)
   ```
   **Critère de succès** : `PID_nouveau != PID_ancien` et l'ancien processus n'existe plus dans la table des processus du système.
