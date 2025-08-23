
// ===== FILE SYSTEM MANAGEMENT =====

// Global variables for file system
let currentFolderHandle = null;
let appFolderHandle = null;
let selectedFolderPath = '';
let fileSystemSupported = false;

// Check if File System Access API is supported
function checkFileSystemSupport() {
    fileSystemSupported = 'showDirectoryPicker' in window;
    console.log('File System Access API supported:', fileSystemSupported);
    return fileSystemSupported;
}

// Initialize file system on app start
async function initializeFileSystem() {
    checkFileSystemSupport();

    // Try to load saved folder path
    const savedPath = localStorage.getItem('app_folder_path');
    if (savedPath) {
        selectedFolderPath = savedPath;
        console.log('Loaded saved folder path:', savedPath);

        // Try to verify the folder still exists and load data
        try {
            await loadFromSavedFolder();
        } catch (error) {
            console.error('Error loading from saved folder:', error);
            // Clear invalid path
            localStorage.removeItem('app_folder_path');
            selectedFolderPath = '';
        }
    }
}

// Select folder using File System Access API or fallback
async function selectFolder() {
    try {
        if (fileSystemSupported) {
            await selectFolderWithFSAPI();
        } else {
            await selectFolderFallback();
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        showNotification('Errore nella selezione della cartella', 'error');
    }
}

// Select folder using File System Access API
async function selectFolderWithFSAPI() {
    try {
        currentFolderHandle = await window.showDirectoryPicker({
            mode: 'readwrite'
        });

        selectedFolderPath = currentFolderHandle.name;

        // Create or access the app folder
        await createAppFolder();

        // Update UI
        updateFolderDisplay();
        validateFolderSelection();

        showNotification('Cartella selezionata con successo', 'success');

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error selecting folder with FS API:', error);
            throw error;
        }
    }
}

// Fallback folder selection (for browsers without FS API)
async function selectFolderFallback() {
    // Create a file input to simulate folder selection
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    return new Promise((resolve, reject) => {
        input.onchange = (event) => {
            const files = event.target.files;
            if (files.length > 0) {
                // Get the common path from the first file
                const firstFile = files[0];
                const pathParts = firstFile.webkitRelativePath.split('/');
                selectedFolderPath = pathParts[0];

                // Update UI
                updateFolderDisplay();
                validateFolderSelection();

                showNotification('Cartella selezionata (modalità compatibilità)', 'success');
                resolve();
            } else {
                reject(new Error('No folder selected'));
            }
        };

        input.onclick = () => {
            input.value = '';
        };

        input.click();
    });
}

// Create or access the app folder
async function createAppFolder() {
    if (!currentFolderHandle) return null;

    try {
        // Try to get existing app folder
        appFolderHandle = await currentFolderHandle.getDirectoryHandle('invoice_app', {
            create: true
        });

        console.log('App folder created/accessed successfully');
        return appFolderHandle;

    } catch (error) {
        console.error('Error creating app folder:', error);
        throw error;
    }
}

// Update folder display in UI
function updateFolderDisplay() {
    const displayElement = document.getElementById('selected-folder-path');
    const folderDisplay = document.getElementById('current-folder-display');

    if (displayElement && folderDisplay) {
        if (selectedFolderPath) {
            displayElement.textContent = selectedFolderPath + '/invoice_app/';
            folderDisplay.classList.remove('empty');
            folderDisplay.classList.add('valid');
        } else {
            displayElement.textContent = 'Nessuna cartella selezionata';
            folderDisplay.classList.add('empty');
            folderDisplay.classList.remove('valid', 'invalid');
        }
    }
}

// Validate folder selection
function validateFolderSelection() {
    const continueBtn = document.getElementById('folder-continue-btn');
    const validationDiv = document.getElementById('folder-validation');

    if (selectedFolderPath && (currentFolderHandle || !fileSystemSupported)) {
        if (continueBtn) continueBtn.disabled = false;
        if (validationDiv) validationDiv.classList.remove('hidden');
        return true;
    } else {
        if (continueBtn) continueBtn.disabled = true;
        if (validationDiv) validationDiv.classList.add('hidden');
        return false;
    }
}

// Proceed to step 3 (doctor configuration)
function proceedToStep2() {
    showSetupStep(2);
}

function proceedToStep3() {
    if (validateFolderSelection()) {
        // Save folder path
        saveFolderPath();
        showSetupStep(3);
    } else {
        showNotification('Seleziona prima una cartella', 'error');
    }
}

function goBackToStep2() {
    showSetupStep(2);
}

// Save folder path
function saveFolderPath() {
    if (selectedFolderPath) {
        localStorage.setItem('app_folder_path', selectedFolderPath);
        console.log('Folder path saved:', selectedFolderPath);
    }
}

// Load from saved folder
async function loadFromSavedFolder() {
    if (!selectedFolderPath) return false;

    try {
        if (fileSystemSupported) {
            // For File System Access API, we need to re-request access
            // This is a limitation - we can't persist handles across sessions
            console.log('File System API: Need to re-request folder access');
            return false;
        } else {
            // For fallback mode, try to load from downloaded files or show import option
            console.log('Fallback mode: Showing import option');
            return false;
        }
    } catch (error) {
        console.error('Error loading from saved folder:', error);
        return false;
    }
}

// ===== FILE OPERATIONS =====

// Write file to app folder
async function writeFileToApp(filename, data) {
    if (!appFolderHandle && fileSystemSupported) {
        throw new Error('App folder not initialized');
    }

    try {
        if (fileSystemSupported) {
            const fileHandle = await appFolderHandle.getFileHandle(filename, {
                create: true
            });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
            console.log(`File written: ${filename}`);
        } else {
            // Fallback: download file
            downloadFile(filename, data);
        }
    } catch (error) {
        console.error(`Error writing file ${filename}:`, error);
        throw error;
    }
}

// Read file from app folder
async function readFileFromApp(filename) {
    if (!appFolderHandle && fileSystemSupported) {
        throw new Error('App folder not initialized');
    }

    try {
        if (fileSystemSupported) {
            const fileHandle = await appFolderHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } else {
            // Fallback: try to load from localStorage or show import dialog
            const data = localStorage.getItem(`fs_${filename}`);
            return data ? JSON.parse(data) : null;
        }
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return null; // File doesn't exist
        }
        console.error(`Error reading file ${filename}:`, error);
        throw error;
    }
}

// Download file (fallback for browsers without FS API)
function downloadFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Also save to localStorage as backup
    localStorage.setItem(`fs_${filename}`, JSON.stringify(data));
}

// Create user folder
async function createUserFolder(username) {
    if (!appFolderHandle && fileSystemSupported) {
        throw new Error('App folder not initialized');
    }

    try {
        if (fileSystemSupported) {
            const usersFolderHandle = await appFolderHandle.getDirectoryHandle('users', {
                create: true
            });
            const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, {
                create: true
            });
            return userFolderHandle;
        } else {
            // In fallback mode, we'll use prefixed localStorage keys
            return true;
        }
    } catch (error) {
        console.error(`Error creating user folder for ${username}:`, error);
        throw error;
    }
}

// ===== DATA MANAGEMENT WITH FILE SYSTEM =====

// Save user data to file system
async function saveUserDataToFS() {
    if (!currentUser) return false;

    try {
        showFileSystemStatus('Salvando dati...', 'loading');

        // Create user folder if needed
        await createUserFolder(currentUser);

        // Prepare data files
        const userData = {
            profile: currentDoctorInfo,
            patients: patients,
            invoices: invoices,
            counters: {
                invoice: invoiceCounter,
                service: serviceCounter
            },
            settings: {
                lastSaved: new Date().toISOString(),
                version: '1.0.0'
            }
        };

        // Save individual files
        await writeUserFile(currentUser, 'profile.json', userData.profile);
        await writeUserFile(currentUser, 'patients.json', userData.patients);
        await writeUserFile(currentUser, 'invoices.json', userData.invoices);
        await writeUserFile(currentUser, 'counters.json', userData.counters);
        await writeUserFile(currentUser, 'settings.json', userData.settings);

        // Update users list
        await updateUsersList();

        showFileSystemStatus('Dati salvati', 'success');
        return true;

    } catch (error) {
        console.error('Error saving user data to FS:', error);
        showFileSystemStatus('Errore nel salvataggio', 'error');

        // Fallback to localStorage
        console.log('Falling back to localStorage');
        saveUserData();
        return false;
    }
}

// Write file for specific user
async function writeUserFile(username, filename, data) {
    if (fileSystemSupported && appFolderHandle) {
        const usersFolderHandle = await appFolderHandle.getDirectoryHandle('users', {
            create: true
        });
        const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username, {
            create: true
        });
        const fileHandle = await userFolderHandle.getFileHandle(filename, {
            create: true
        });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
    } else {
        // Fallback: use localStorage with prefix
        localStorage.setItem(`fs_${username}_${filename}`, JSON.stringify(data));
    }
}

// Read file for specific user
async function readUserFile(username, filename) {
    try {
        if (fileSystemSupported && appFolderHandle) {
            const usersFolderHandle = await appFolderHandle.getDirectoryHandle('users');
            const userFolderHandle = await usersFolderHandle.getDirectoryHandle(username);
            const fileHandle = await userFolderHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } else {
            // Fallback: use localStorage with prefix
            const data = localStorage.getItem(`fs_${username}_${filename}`);
            return data ? JSON.parse(data) : null;
        }
    } catch (error) {
        if (error.name === 'NotFoundError') {
            return null;
        }
        throw error;
    }
}

// Update users list file
async function updateUsersList() {
    try {
        let usersData = await readFileFromApp('users.json') || {
            users: [],
            lastUser: null
        };

        if (!usersData.users.includes(currentUser)) {
            usersData.users.push(currentUser);
        }
        usersData.lastUser = currentUser;
        usersData.lastUpdated = new Date().toISOString();

        await writeFileToApp('users.json', usersData);

    } catch (error) {
        console.error('Error updating users list:', error);
    }
}

// Load user data from file system
async function loadUserDataFromFS(username) {
    try {
        showFileSystemStatus('Caricando dati...', 'loading');

        // Load individual files
        const profile = await readUserFile(username, 'profile.json');
        const patientsData = await readUserFile(username, 'patients.json');
        const invoicesData = await readUserFile(username, 'invoices.json');
        const countersData = await readUserFile(username, 'counters.json');

        if (profile) {
            currentDoctorInfo = profile;
            patients = patientsData || [...samplePatients];
            invoices = invoicesData || [];

            if (countersData) {
                invoiceCounter = countersData.invoice || 1;
                serviceCounter = countersData.service || 1;
            }

            showFileSystemStatus('Dati caricati', 'success');
            return true;
        } else {
            showFileSystemStatus('Nessun dato trovato', 'warning');
            return false;
        }

    } catch (error) {
        console.error('Error loading user data from FS:', error);
        showFileSystemStatus('Errore nel caricamento', 'error');

        // Fallback to localStorage
        console.log('Falling back to localStorage');
        return false;
    }
}

// Get users list from file system
async function getUsersListFromFS() {
    try {
        const usersData = await readFileFromApp('users.json');
        return usersData ? usersData.users : [];
    } catch (error) {
        console.error('Error getting users list from FS:', error);
        return [];
    }
}

// Show file system status
function showFileSystemStatus(message, type) {
    // Create or update status indicator
    let statusElement = document.getElementById('fs-status');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'fs-status';
        statusElement.className = 'fs-status';

        // Try to add to form header or navigation
        const formHeader = document.querySelector('.form-header');
        const navigation = document.querySelector('.navigation');
        if (formHeader) {
            formHeader.appendChild(statusElement);
        } else if (navigation) {
            navigation.appendChild(statusElement);
        }
    }

    statusElement.className = `fs-status fs-status--${type}`;
    statusElement.innerHTML = `
        ${type === 'loading' ? '<span class="loading-spinner"></span>' : ''}
        <span>${message}</span>
    `;

    // Auto-hide success/error messages after 3 seconds
    if (type !== 'loading') {
        setTimeout(() => {
            if (statusElement) {
                statusElement.style.opacity = '0';
                setTimeout(() => {
                    if (statusElement && statusElement.parentNode) {
                        statusElement.parentNode.removeChild(statusElement);
                    }
                }, 300);
            }
        }, 3000);
    }
}

// Export user data (for backup/migration)
async function exportUserData() {
    if (!currentUser) {
        showNotification('Nessun utente selezionato', 'error');
        return;
    }

    try {
        const exportData = {
            user: currentUser,
            profile: currentDoctorInfo,
            patients: patients,
            invoices: invoices,
            counters: {
                invoice: invoiceCounter,
                service: serviceCounter
            },
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const filename = `invoice_app_backup_${currentUser}_${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(filename, exportData);

        showNotification('Backup esportato con successo', 'success');

    } catch (error) {
        console.error('Error exporting user data:', error);
        showNotification('Errore durante l'esportazione', 'error');
    }
}

// Import user data (from backup file)
function importUserData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importData = JSON.parse(text);

            // Validate import data
            if (!importData.user || !importData.profile) {
                throw new Error('File di backup non valido');
            }

            // Confirm import
            if (!confirm(`Importare i dati per l'utente "${importData.user}"? I dati attuali verranno sovrascritti.`)) {
                return;
            }

            // Import data
            currentUser = importData.user;
            currentDoctorInfo = importData.profile;
            patients = importData.patients || [...samplePatients];
            invoices = importData.invoices || [];

            if (importData.counters) {
                invoiceCounter = importData.counters.invoice || 1;
                serviceCounter = importData.counters.service || 1;
            }

            // Save imported data
            await saveUserDataToFS();

            // Update UI
            updateUserInterface();
            updatePreview();

            showNotification(`Dati importati per ${currentUser}`, 'success');

        } catch (error) {
            console.error('Error importing user data:', error);
            showNotification('Errore durante l'importazione', 'error');
        }
    };

    input.click();
}
