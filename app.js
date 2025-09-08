// Global variables
let currentUser = null;
let currentDoctorInfo = null;
let invoiceCounter = 1;
let invoiceYear = new Date().getFullYear();
let serviceCounter = 1;
let currentPage = 'generator';
let patients = [];
let invoices = [];

// Default doctor data
const defaultDoctorInfo = {
    name: "Dr. Pinco Pallino ",
    address: "Indirizzo, CAP , Città , Provincia",
    piva: "11 cifre",
    cf: "codice fiscale",
    professional_title: "Medico-chirurgo",
    medical_order: "O.M. Torino 00000"
};

// Legal text constants
const legalText = {
    iva_exemption: "IVA: esente ai sensi dell'art. 10 comma 18 DPR 633/1972",
    stamp_duty: "Marca da bollo €2,00 applicata se importo > € 77,47",
    fiscal_regime: "Regime fiscale: Operazione effettuata ai sensi dell'articolo 1, commi 54-89, Legge 190/2014 (regime forfettario) - esente IVA"
};

// Sample patients data
const samplePatients = [
    {
        id: 1,
        title: "Signore",
        name: "Mario Rossi", 
        address: "Via Roma 123, 10100 Torino",
        tax_code: "RSSMRA80A01L219X"
    },
    {
        id: 2,
        title: "Signora",
        name: "Anna Bianchi",
        address: "Corso Francia 45, 10138 Torino", 
        tax_code: "BNCNNA75B02L219Y"
    }
];


// Generate invoice number with year format (e.g., 0001-2025)
function generateInvoiceNumber(number, year) {
    return number.toString().padStart(4, '0') + '-' + year.toString();
}

// Check if we need to reset counter for new year
function checkAndResetYearCounter() {
    const currentYear = new Date().getFullYear();
    if (currentYear !== invoiceYear) {
        invoiceYear = currentYear;
        invoiceCounter = 1;
        saveUserData(); // Save the reset
        return true; // Indica che è¨ stato fatto un reset
    }
    return false;
}

// Parse invoice number from format "0001-2025" to get the numeric part
function parseInvoiceNumber(invoiceNumberString) {
    if (!invoiceNumberString) return { number: 1, year: new Date().getFullYear() };

    const parts = invoiceNumberString.split('-');
    if (parts.length === 2) {
        const number = parseInt(parts[0], 10) || 1;
        const year = parseInt(parts[1], 10) || new Date().getFullYear();
        return { number, year };
    }

    // Fallback per formati legacy
    const number = parseInt(invoiceNumberString, 10) || 1;
    return { number, year: new Date().getFullYear() };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Starting initialization...');
    initializeApp();
});

function initializeApp() {
    // Check if user exists
    const savedUser = localStorage.getItem('current_user');
    if (savedUser && getUserProfiles().includes(savedUser)) {
        loadUser(savedUser);
        hideUserSetupModal();
        setupFormListeners();
        initializeInvoiceForm();
    } else {
        showUserSetupModal();
    }
}

function showUserSetupModal() {
    const modal = document.getElementById('user-setup-modal');
    if (modal) {
        modal.classList.remove('hidden');
        showSetupStep(1);
    }
}

function hideUserSetupModal() {
    const modal = document.getElementById('user-setup-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showSetupStep(step) {
    // Hide all steps
    document.querySelectorAll('.setup-step').forEach(el => el.classList.add('hidden'));
    
    // Show selected step
    const targetStep = document.getElementById(`setup-step-${step}`);
    if (targetStep) {
        targetStep.classList.remove('hidden');
    }
    
    if (step === 2) {
        // Pre-fill doctor info with defaults
        document.getElementById('doctor-name').value = defaultDoctorInfo.name;
        document.getElementById('doctor-address').value = defaultDoctorInfo.address;
        document.getElementById('doctor-piva').value = defaultDoctorInfo.piva;
        document.getElementById('doctor-cf').value = defaultDoctorInfo.cf;
        document.getElementById('doctor-title').value = defaultDoctorInfo.professional_title;
        document.getElementById('doctor-order').value = defaultDoctorInfo.medical_order;
    }
}

function checkUser() {
    const username = document.getElementById('username-input').value.trim();
    if (!username) {
        showNotification('Inserisci un nome utente valido', 'error');
        return;
    }
    
    const userProfiles = getUserProfiles();
    if (userProfiles.includes(username)) {
        // Existing user - load their data
        loadUser(username);
        hideUserSetupModal();
        setupFormListeners();
        initializeInvoiceForm();
        showNotification(`Benvenuto, ${username}!`, 'success');
    } else {
        // New user - continue to doctor setup
        currentUser = username;
        showSetupStep(2);
    }
}

function goBackToStep1() {
    showSetupStep(1);
}

function completeSetup() {
    // Validate doctor info
    const doctorData = {
        name: document.getElementById('doctor-name').value.trim(),
        address: document.getElementById('doctor-address').value.trim(),
        piva: document.getElementById('doctor-piva').value.trim(),
        cf: document.getElementById('doctor-cf').value.trim(),
        professional_title: document.getElementById('doctor-title').value.trim(),
        medical_order: document.getElementById('doctor-order').value.trim()
    };
    
    if (!doctorData.name || !doctorData.address || !doctorData.piva || !doctorData.cf || 
        !doctorData.professional_title || !doctorData.medical_order) {
        showNotification('Compila tutti i campi del medico', 'error');
        return;
    }
    
    // Save user data
    currentDoctorInfo = doctorData;
    saveUserData();
    
    // Generate sync code
    const syncCode = generateSyncCode();
    saveUserSyncCode(syncCode);
    
    // Show sync code and QR
    document.getElementById('user-sync-code').textContent = syncCode;
    
    // Generate QR code with delay to ensure DOM is ready
    setTimeout(() => {
        generateQRCode(syncCode, 'qr-code');
    }, 100);
    
    showSetupStep(3);
}

function finishSetup() {
    hideUserSetupModal();
    setupFormListeners();
    initializeInvoiceForm();
    updateUserInterface();
    showNotification('Configurazione completata!', 'success');
}

function generateSyncCode() {
    return 'SYNC-' + Math.random().toString(36).substr(2, 8).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
}

function generateQRCode(text, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas element not found:', canvasId);
        return;
    }
    
    // Check if QRCode library is loaded
    if (typeof QRCode === 'undefined') {
        console.warn('QRCode library not loaded, creating fallback');
        createQRCodeFallback(canvas, text);
        return;
    }
    
    try {
        // Clear any existing content
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        QRCode.toCanvas(canvas, text, {
            width: 200,
            height: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        }, function (error) {
            if (error) {
                console.error('QR Code generation error:', error);
                createQRCodeFallback(canvas, text);
            } else {
                console.log('QR Code generated successfully');
            }
        });
    } catch (error) {
        console.error('QR Code generation failed:', error);
        createQRCodeFallback(canvas, text);
    }
}

function createQRCodeFallback(canvas, text) {
    // Create a simple fallback when QR code library fails
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 200;
    
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 200, 200);
    
    // Black border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, 190, 190);
    
    // Text content
    ctx.fillStyle = '#000000';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR Code:', 100, 30);
    
    // Split text into lines for better display
    const maxWidth = 180;
    const lineHeight = 14;
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const testLine = currentLine + char;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = char;
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);
    
    // Display text lines
    let yPos = 50;
    lines.forEach(line => {
        if (yPos < 190) {
            ctx.fillText(line, 100, yPos);
            yPos += lineHeight;
        }
    });
}

// User management functions
function getUserProfiles() {
    const profiles = localStorage.getItem('user_profiles');
    return profiles ? JSON.parse(profiles) : [];
}

function saveUserProfile(username) {
    const profiles = getUserProfiles();
    if (!profiles.includes(username)) {
        profiles.push(username);
        localStorage.setItem('user_profiles', JSON.stringify(profiles));
    }
}

function loadUser(username) {
    currentUser = username;
    localStorage.setItem('current_user', username);
    
    // Load doctor info
    const doctorKey = `user_${username}_doctor`;
    const savedDoctorInfo = localStorage.getItem(doctorKey);
    currentDoctorInfo = savedDoctorInfo ? JSON.parse(savedDoctorInfo) : {...defaultDoctorInfo};
    
    // Load user data
    patients = getUserData(username, 'patients') || [...samplePatients];
    invoices = getUserData(username, 'invoices') || [];
    
    // Load counters
    const counters = getUserData(username, 'counters') || { invoice: 1, service: 1 };
    invoiceCounter = counters.invoice;
    serviceCounter = counters.service;
    
    saveUserProfile(username);
    updateUserInterface();
}

function saveUserData() {
    if (!currentUser) return;
    
    // Save doctor info
    const doctorKey = `user_${currentUser}_doctor`;
    localStorage.setItem(doctorKey, JSON.stringify(currentDoctorInfo));
    
    // Save patients
    setUserData(currentUser, 'patients', patients);
    
    // Save invoices
    setUserData(currentUser, 'invoices', invoices);
    
    // Save counters
    setUserData(currentUser, 'counters', { 
        invoice: invoiceCounter, 
        service: serviceCounter 
    });
    
    saveUserProfile(currentUser);
}

function getUserData(username, dataType) {
    const key = `user_${username}_${dataType}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}

function setUserData(username, dataType, data) {
    const key = `user_${username}_${dataType}`;
    localStorage.setItem(key, JSON.stringify(data));
}

function saveUserSyncCode(syncCode) {
    if (!currentUser) return;
    const key = `user_${currentUser}_sync_code`;
    localStorage.setItem(key, syncCode);
}

function getUserSyncCode(username) {
    const key = `user_${username}_sync_code`;
    return localStorage.getItem(key);
}

function updateUserInterface() {
    if (!currentUser || !currentDoctorInfo) return;
    
    // Update navigation
    document.getElementById('current-user-name').textContent = currentUser;
    document.getElementById('current-doctor-name').textContent = currentDoctorInfo.name;
    
    // Update form header
    document.getElementById('form-doctor-name').textContent = currentDoctorInfo.name;
    
    // Update preview
    updateDoctorPreview();
    updatePatientSelect();
    updateManagementView();
}

function updateDoctorPreview() {
    if (!currentDoctorInfo) return;
    
    document.getElementById('preview-doctor-name').textContent = currentDoctorInfo.name;
    document.getElementById('preview-doctor-address').textContent = currentDoctorInfo.address;
    document.getElementById('preview-doctor-piva').textContent = currentDoctorInfo.piva;
    document.getElementById('preview-doctor-cf').textContent = currentDoctorInfo.cf;
    
    document.getElementById('preview-signature-name').textContent = currentDoctorInfo.name;
    document.getElementById('preview-signature-title').textContent = currentDoctorInfo.professional_title;
    document.getElementById('preview-signature-order').textContent = currentDoctorInfo.medical_order;
    document.getElementById('preview-signature-piva').textContent = currentDoctorInfo.piva;
}

function initializeInvoiceForm() {
    // Set current date
    const today = new Date().toISOString().split('T')[0];
    const invoiceDateField = document.getElementById('invoice-date');
    if (invoiceDateField) {
        invoiceDateField.value = today;
    }
    
    // Set initial invoice number
    const invoiceNumberField = document.getElementById('invoice-number');
    if (invoiceNumberField) {
        invoiceNumberField.value = generateInvoiceNumber(invoiceCounter, invoiceYear);
    }
    
    // Show generator page by default
    showPage('generator');
    
    updatePreview();
}

function setupFormListeners() {
    console.log('Setting up form listeners...');
    
    const form = document.getElementById('invoice-form');
    
    // Form submission
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Patient selection
    const patientSelect = document.getElementById('patient-select');
    if (patientSelect) {
        patientSelect.addEventListener('change', loadSelectedPatient);
    }
    
    // Real-time form updates
    if (form) {
        form.addEventListener('input', updatePreview);
        form.addEventListener('change', updatePreview);
    }
    
    // Service container event delegation
    const servicesContainer = document.getElementById('services-container');
    if (servicesContainer) {
        servicesContainer.addEventListener('click', function(e) {
            if (e.target && e.target.classList.contains('remove-service')) {
                e.preventDefault();
                removeServiceEntry(e.target);
            }
        });
        
        servicesContainer.addEventListener('input', function(e) {
            if (e.target && (e.target.classList.contains('service-amount') || 
                e.target.classList.contains('service-quantity'))) {
                calculateTotal();
                updatePreview();
            }
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });
    
    
    // Invoice number manual edit listener
    const invoiceNumberField = document.getElementById('invoice-number');
    if (invoiceNumberField) {
        invoiceNumberField.addEventListener('input', function() {
            // Validate and update preview when invoice number is manually changed
            updatePreview();
        });

        invoiceNumberField.addEventListener('blur', function() {
            // When user finishes editing, validate the format
            const value = this.value.trim();
            if (value) {
                const parsed = parseInvoiceNumber(value);
                this.value = generateInvoiceNumber(parsed.number, parsed.year);

                // Update internal counters
                invoiceCounter = parsed.number;
                invoiceYear = parsed.year;
            }
        });
    }

    console.log('Form listeners setup complete');
}

// Navigation functions
function showPage(page) {
    // Hide all pages
    document.querySelectorAll('.page-container').forEach(p => p.classList.add('hidden'));
    
    // Show selected page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('nav-btn--active');
    });
    
    const activeNavBtn = document.getElementById(`nav-${page}`);
    if (activeNavBtn) {
        activeNavBtn.classList.add('nav-btn--active');
    }
    
    currentPage = page;
    
    if (page === 'management') {
        updateManagementView();
    }
}

function toggleUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

function editDoctorInfo() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.add('hidden');
    
    // Pre-fill edit form
    document.getElementById('edit-doctor-name').value = currentDoctorInfo.name;
    document.getElementById('edit-doctor-address').value = currentDoctorInfo.address;
    document.getElementById('edit-doctor-piva').value = currentDoctorInfo.piva;
    document.getElementById('edit-doctor-cf').value = currentDoctorInfo.cf;
    document.getElementById('edit-doctor-title').value = currentDoctorInfo.professional_title;
    document.getElementById('edit-doctor-order').value = currentDoctorInfo.medical_order;
    
    document.getElementById('doctor-edit-modal').classList.remove('hidden');
}

function cancelDoctorEdit() {
    document.getElementById('doctor-edit-modal').classList.add('hidden');
}

function saveDoctorEdit() {
    const doctorData = {
        name: document.getElementById('edit-doctor-name').value.trim(),
        address: document.getElementById('edit-doctor-address').value.trim(),
        piva: document.getElementById('edit-doctor-piva').value.trim(),
        cf: document.getElementById('edit-doctor-cf').value.trim(),
        professional_title: document.getElementById('edit-doctor-title').value.trim(),
        medical_order: document.getElementById('edit-doctor-order').value.trim()
    };
    
    if (!doctorData.name || !doctorData.address || !doctorData.piva || !doctorData.cf || 
        !doctorData.professional_title || !doctorData.medical_order) {
        showNotification('Compila tutti i campi del medico', 'error');
        return;
    }
    
    currentDoctorInfo = doctorData;
    saveUserData();
    updateUserInterface();
    updatePreview();
    
    document.getElementById('doctor-edit-modal').classList.add('hidden');
    showNotification('Dati medico aggiornati', 'success');
}

function showSyncOptions() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.add('hidden');
    
    const syncCode = getUserSyncCode(currentUser);
    if (syncCode) {
        document.getElementById('current-sync-code').textContent = syncCode;
        
        // Generate QR code with delay
        setTimeout(() => {
            generateQRCode(syncCode, 'sync-qr-code');
        }, 100);
        
        document.getElementById('sync-modal').classList.remove('hidden');
    } else {
        showNotification('Codice di sincronizzazione non trovato', 'error');
    }
}

function hideSyncModal() {
    document.getElementById('sync-modal').classList.add('hidden');
}

function copySyncCode() {
    const syncCode = document.getElementById('user-sync-code').textContent;
    copyToClipboard(syncCode);
}

function copyCurrentSyncCode() {
    const syncCode = document.getElementById('current-sync-code').textContent;
    copyToClipboard(syncCode);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('Codice copiato negli appunti', 'success');
    }).catch(() => {
        showNotification('Errore nella copia del codice', 'error');
    });
}

function switchUser() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.add('hidden');
    
    if (confirm('Vuoi cambiare utente? I dati correnti verranno salvati.')) {
        saveUserData();
        currentUser = null;
        currentDoctorInfo = null;
        localStorage.removeItem('current_user');
        location.reload();
    }
}

// Patient management
function updatePatientSelect() {
    const select = document.getElementById('patient-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Seleziona paziente salvato...</option>';
    
    patients.forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.id;
        option.textContent = `${patient.title} ${patient.name}`;
        select.appendChild(option);
    });
}

function loadSelectedPatient() {
    const select = document.getElementById('patient-select');
    const selectedId = parseInt(select?.value);
    
    if (!selectedId) return;
    
    const patient = patients.find(p => p.id === selectedId);
    if (!patient) return;
    
    // Fill form fields
    document.getElementById('patient-title').value = patient.title;
    document.getElementById('patient-name').value = patient.name;
    document.getElementById('patient-address').value = patient.address;
    document.getElementById('patient-cf').value = patient.tax_code;
    
    updatePreview();
    showNotification(`Paziente ${patient.name} caricato`, 'success');
}

function saveCurrentPatient() {
    const title = document.getElementById('patient-title')?.value || '';
    const name = document.getElementById('patient-name')?.value || '';
    const address = document.getElementById('patient-address')?.value || '';
    const taxCode = document.getElementById('patient-cf')?.value || '';
    
    if (!title || !name || !address || !taxCode) {
        showNotification('Compila tutti i campi del paziente', 'error');
        return;
    }
    
    // Check if patient already exists
    const existingPatient = patients.find(p => 
        p.name.toLowerCase() === name.toLowerCase() && 
        p.tax_code.toLowerCase() === taxCode.toLowerCase()
    );
    
    if (existingPatient) {
        showNotification('Paziente già  presente', 'warning');
        return;
    }
    
    const newPatient = {
        id: Date.now(),
        title,
        name,
        address,
        tax_code: taxCode
    };
    
    patients.push(newPatient);
    updatePatientSelect();
    saveUserData();
    
    showNotification(`Paziente ${name} salvato`, 'success');
}

// Form handling
function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        showNotification('Compila tutti i campi obbligatori', 'error');
        return;
    }
    
    // Create invoice data
    const invoiceData = generateInvoiceData();
    
    // Save invoice
    invoices.push(invoiceData);
    saveUserData();
    
    // Increment invoice number for next invoice
    invoiceCounter++;
    const invoiceNumberField = document.getElementById('invoice-number');
    if (invoiceNumberField) {
        invoiceNumberField.value = generateInvoiceNumber(invoiceCounter, invoiceYear);
    }
    
    showNotification('Fattura salvata con successo!', 'success');
    updatePreview();
}

function generateInvoiceData() {
    const invoiceData = {
        id: Date.now(),
        number: document.getElementById('invoice-number')?.value || '',
        date: document.getElementById('invoice-date')?.value || '',
        patient: {
            title: document.getElementById('patient-title')?.value || '',
            name: document.getElementById('patient-name')?.value || '',
            address: document.getElementById('patient-address')?.value || '',
            tax_code: document.getElementById('patient-cf')?.value || ''
        },
        doctor: {...currentDoctorInfo},
        services: [],
        total: 0,
        tracedPayment: document.getElementById('traced-payment')?.checked || false,
        createdAt: new Date().toISOString()
    };
    
    // Collect services
    const serviceEntries = document.querySelectorAll('.service-entry');
    serviceEntries.forEach((entry, index) => {
        const type = entry.querySelector('.service-type')?.value || '';
        const quantity = parseFloat(entry.querySelector('.service-quantity')?.value) || 0;
        const amount = parseFloat(entry.querySelector('.service-amount')?.value) || 0;
        
        if (type && quantity && amount) {
            invoiceData.services.push({
                id: index + 1,
                type,
                quantity,
                amount,
                total: quantity * amount
            });
        }
    });
    
    // Calculate total
    invoiceData.total = invoiceData.services.reduce((sum, service) => sum + service.total, 0);
    
    return invoiceData;
}

function validateForm() {
    const requiredFields = [
        'patient-title',
        'patient-name', 
        'patient-address',
        'patient-cf',
        'invoice-date'
    ];
    
    let isValid = true;
    
    // Check required fields
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field || !field.value.trim()) {
            if (field) {
                field.style.borderColor = 'var(--color-error)';
            }
            isValid = false;
        } else {
            field.style.borderColor = '';
        }
    });
    
    // Check services
    const serviceEntries = document.querySelectorAll('.service-entry');
    let hasValidService = false;
    
    serviceEntries.forEach(entry => {
        const type = entry.querySelector('.service-type');
        const quantity = entry.querySelector('.service-quantity');
        const amount = entry.querySelector('.service-amount');
        
        if (type?.value.trim() && quantity?.value && amount?.value) {
            hasValidService = true;
            type.style.borderColor = '';
            quantity.style.borderColor = '';
            amount.style.borderColor = '';
        } else {
            if (type) type.style.borderColor = !type.value.trim() ? 'var(--color-error)' : '';
            if (quantity) quantity.style.borderColor = !quantity.value ? 'var(--color-error)' : '';
            if (amount) amount.style.borderColor = !amount.value ? 'var(--color-error)' : '';
        }
    });
    
    return isValid && hasValidService;
}

// Service management
function addServiceEntry() {
    serviceCounter++;
    const container = document.getElementById('services-container');
    
    if (!container) return;
    
    const serviceEntry = document.createElement('div');
    serviceEntry.className = 'service-entry';
    serviceEntry.setAttribute('data-index', serviceCounter - 1);
    
    serviceEntry.innerHTML = `
        <div class="service-header">
            <h4>Prestazione ${serviceCounter}</h4>
            <button type="button" class="remove-service">Rimuovi</button>
        </div>
        
        <div class="form-group">
            <label class="form-label">Tipologia Prestazione</label>
            <input type="text" class="form-control service-type" placeholder="Descrizione della prestazione" required>
        </div>
        
        <div class="form-row">
            <div class="form-group">
                <label class="form-label">Quantità </label>
                <input type="number" class="form-control service-quantity" min="1" step="1" value="1" required>
            </div>
            
            <div class="form-group">
                <label class="form-label">Importo (EUR)</label>
                <input type="number" class="form-control service-amount" min="0" step="0.01" placeholder="0.00" required>
            </div>
        </div>
    `;
    
    container.appendChild(serviceEntry);
    
    const newServiceType = serviceEntry.querySelector('.service-type');
    if (newServiceType) {
        setTimeout(() => newServiceType.focus(), 100);
    }
    
    updatePreview();
    showNotification(`Prestazione ${serviceCounter} aggiunta`, 'success');
}

function removeServiceEntry(button) {
    const serviceEntry = button.closest('.service-entry');
    const container = document.getElementById('services-container');
    
    if (!container || !serviceEntry) return;
    
    if (container.children.length > 1) {
        serviceEntry.remove();
        renumberServices();
        calculateTotal();
        updatePreview();
        showNotification('Prestazione rimossa', 'info');
    } else {
        showNotification('Deve essere presente almeno una prestazione', 'warning');
    }
}

function renumberServices() {
    const serviceEntries = document.querySelectorAll('.service-entry');
    serviceEntries.forEach((entry, index) => {
        const header = entry.querySelector('.service-header h4');
        if (header) {
            header.textContent = `Prestazione ${index + 1}`;
        }
        entry.setAttribute('data-index', index);
    });
    serviceCounter = serviceEntries.length;
}

function calculateTotal() {
    let total = 0;
    const serviceEntries = document.querySelectorAll('.service-entry');
    
    serviceEntries.forEach(entry => {
        const quantity = parseFloat(entry.querySelector('.service-quantity')?.value) || 0;
        const amount = parseFloat(entry.querySelector('.service-amount')?.value) || 0;
        total += quantity * amount;
    });
    
    const totalFormatted = total.toFixed(2).replace('.', ',');
    
    const totalAmountElement = document.getElementById('total-amount');
    const previewTotalElement = document.getElementById('preview-total');
    
    if (totalAmountElement) {
        totalAmountElement.textContent = `${totalFormatted} EUR`;
    }
    if (previewTotalElement) {
        previewTotalElement.textContent = `${totalFormatted} EUR`;
    }
    
    return total;
}

function updatePreview() {
    // Patient information
    const patientTitle = document.getElementById('patient-title')?.value || '';
    const patientName = document.getElementById('patient-name')?.value || '';
    const patientAddress = document.getElementById('patient-address')?.value || '';
    const patientCf = document.getElementById('patient-cf')?.value || '';
    
    document.getElementById('preview-patient-title').textContent = patientTitle;
    document.getElementById('preview-patient-name').textContent = patientName;
    document.getElementById('preview-patient-address').textContent = patientAddress;
    document.getElementById('preview-patient-cf').textContent = patientCf;
    
    // Invoice details
    const invoiceNumber = document.getElementById('invoice-number')?.value || '';
    const invoiceDate = document.getElementById('invoice-date')?.value || '';
    
    document.getElementById('preview-invoice-number').textContent = invoiceNumber || '_____';
    
    if (invoiceDate) {
        const date = new Date(invoiceDate);
        const formattedDate = date.toLocaleDateString('it-IT');
        document.getElementById('preview-invoice-date').textContent = formattedDate;
    } else {
        document.getElementById('preview-invoice-date').textContent = '_____';
    }
    
    // Traced payment
    const tracedPayment = document.getElementById('traced-payment')?.checked || false;
    document.getElementById('preview-payment-traced').textContent = 
        tracedPayment ? 'SI [X] NO [_]' : 'SI [_] NO [X]';
    
    // Services
    updateServicesPreview();
    
    // Calculate and update total
    calculateTotal();
}

function updateServicesPreview() {
    const servicesContainer = document.getElementById('preview-services');
    const serviceEntries = document.querySelectorAll('.service-entry');
    
    if (!servicesContainer) return;
    
    if (serviceEntries.length === 0 || !hasValidServices()) {
        servicesContainer.innerHTML = '<p class="placeholder-text">I servizi appariranno qui...</p>';
        return;
    }
    
    let servicesHtml = '';
    
    serviceEntries.forEach((entry, index) => {
        const type = entry.querySelector('.service-type')?.value || '';
        const quantity = entry.querySelector('.service-quantity')?.value || '';
        const amount = entry.querySelector('.service-amount')?.value || '';
        
        if (type && quantity && amount) {
            const formattedAmount = parseFloat(amount).toFixed(2).replace('.', ',');
            servicesHtml += `
                <div class="service-item">
                    <h4>${index + 1}. Tipologia prestazione: ${type}</h4>
                    <div class="service-details">
                        <p>* Quantità : ${quantity}</p>
                        <p>* Importo: ${formattedAmount} EUR</p>
                    </div>
                </div>
            `;
        }
    });
    
    servicesContainer.innerHTML = servicesHtml || '<p class="placeholder-text">I servizi appariranno qui...</p>';
}

function hasValidServices() {
    const serviceEntries = document.querySelectorAll('.service-entry');
    return Array.from(serviceEntries).some(entry => {
        const type = entry.querySelector('.service-type')?.value || '';
        const quantity = entry.querySelector('.service-quantity')?.value || '';
        const amount = entry.querySelector('.service-amount')?.value || '';
        return type && quantity && amount;
    });
}

// Print and PDF functions
function printInvoice() {
    if (!validateForm()) {
        showNotification('Compila tutti i campi prima di stampare', 'error');
        return;
    }
    
    showNotification('Preparazione stampa...', 'info');
    
    setTimeout(() => {
        try {
            window.print();
        } catch (error) {
            console.error('Print error:', error);
            showNotification('Errore durante la stampa', 'error');
        }
    }, 500);
}

function generatePDF() {
    if (!validateForm()) {
        showNotification('Compila tutti i campi prima di generare il PDF', 'error');
        return;
    }
    
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Set font
        pdf.setFont('helvetica');
        
        // Title
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('FATTURA PER PRESTAZIONE SANITARIA', 105, 20, { align: 'center' });
        
        // Doctor info
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        let yPos = 40;
        
        if (currentDoctorInfo) {
            pdf.text(currentDoctorInfo.name, 20, yPos);
            pdf.text(currentDoctorInfo.address, 20, yPos + 5);
            pdf.text(`P.IVA ${currentDoctorInfo.piva}`, 20, yPos + 10);
            pdf.text(`C.F. ${currentDoctorInfo.cf}`, 20, yPos + 15);
        }
        
        // Patient info
        yPos = 70;
        const patientTitle = document.getElementById('patient-title')?.value || '';
        const patientName = document.getElementById('patient-name')?.value || '';
        const patientAddress = document.getElementById('patient-address')?.value || '';
        const patientCf = document.getElementById('patient-cf')?.value || '';
        
        if (patientTitle) pdf.text(patientTitle, 20, yPos);
        if (patientName) pdf.text(patientName, 20, yPos + 5);
        if (patientAddress) {
            const addressLines = pdf.splitTextToSize(patientAddress, 170);
            addressLines.forEach((line, index) => {
                pdf.text(line, 20, yPos + 10 + (index * 5));
            });
            yPos += (addressLines.length - 1) * 5;
        }
        if (patientCf) pdf.text(patientCf, 20, yPos + 15);
        
        // Invoice details
        yPos += 30;
        const invoiceNumber = document.getElementById('invoice-number')?.value || '';
        const invoiceDate = document.getElementById('invoice-date')?.value || '';
        
        pdf.text(`Fattura N. ${invoiceNumber}`, 20, yPos);
        if (invoiceDate) {
            const date = new Date(invoiceDate);
            const formattedDate = date.toLocaleDateString('it-IT');
            pdf.text(`Data di emissione ${formattedDate}`, 20, yPos + 5);
        }
        
        // Services
        yPos += 20;
        pdf.setFont('helvetica', 'bold');
        pdf.text('DESCRIZIONE DELLA PRESTAZIONE', 20, yPos);
        pdf.setFont('helvetica', 'normal');
        yPos += 10;
        
        const serviceEntries = document.querySelectorAll('.service-entry');
        serviceEntries.forEach((entry, index) => {
            const type = entry.querySelector('.service-type')?.value || '';
            const quantity = entry.querySelector('.service-quantity')?.value || '';
            const amount = entry.querySelector('.service-amount')?.value || '';
            
            if (type && quantity && amount) {
                pdf.text(`${index + 1}. Tipologia prestazione: ${type}`, 20, yPos);
                pdf.text(`* Quantità : ${quantity}`, 25, yPos + 5);
                const formattedAmount = parseFloat(amount).toFixed(2).replace('.', ',');
                pdf.text(`* Importo: ${formattedAmount} EUR`, 25, yPos + 10);
                yPos += 20;
            }
        });
        
        // Total
        const total = calculateTotal();
        const totalFormatted = total.toFixed(2).replace('.', ',');
        pdf.setFont('helvetica', 'bold');
        pdf.text(`Totale imponibile: ${totalFormatted} EUR`, 20, yPos);
        
        // Traced payment
        yPos += 10;
        const tracedPayment = document.getElementById('traced-payment')?.checked || false;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Pagamento tracciato: ${tracedPayment ? 'SI [X] NO [_]' : 'SI [_] NO [X]'}`, 20, yPos);
        
        // Legal text
        yPos += 15;
        pdf.setFontSize(8);
        pdf.text('IVA: esente ai sensi dell\'art. 10 comma 18 DPR 633/1972', 20, yPos);
        pdf.text('Marca da bollo â‚¬ 2,00 applicata se importo > â‚¬ 77,47', 20, yPos + 5);
        const fiscalText = 'Regime fiscale: Operazione effettuata ai sensi dell\'articolo 1, commi 54-89, Legge 190/2014 (regime forfettario) - esente IVA';
        const fiscalLines = pdf.splitTextToSize(fiscalText, 170);
        fiscalLines.forEach((line, index) => {
            pdf.text(line, 20, yPos + 10 + (index * 4));
        });
        
        // Signature
        yPos += 30;
        pdf.setFontSize(10);
        if (currentDoctorInfo) {
            pdf.text(currentDoctorInfo.name, 105, yPos, { align: 'center' });
            pdf.text(currentDoctorInfo.professional_title, 105, yPos + 5, { align: 'center' });
            pdf.text(currentDoctorInfo.medical_order, 105, yPos + 10, { align: 'center' });
            pdf.text(`P.IVA ${currentDoctorInfo.piva}`, 105, yPos + 15, { align: 'center' });
        }
        
        // Save PDF
        const fileName = `Fattura_${invoiceNumber}_${patientName.replace(/\s+/g, '_')}.pdf`;
        pdf.save(fileName);
        
        showNotification('PDF generato e scaricato', 'success');
        
    } catch (error) {
        console.error('PDF generation error:', error);
        showNotification('Errore nella generazione del PDF', 'error');
    }
}

function resetForm() {
    if (!confirm('Sei sicuro di voler resettare il form? Tutti i dati inseriti verranno persi.')) {
        return;
    }
    
    // Reset the form
    const form = document.getElementById('invoice-form');
    if (form) form.reset();
    
    // Reset patient select
    document.getElementById('patient-select').value = '';
    
    // Reset services to single entry
    const servicesContainer = document.getElementById('services-container');
    if (servicesContainer) {
        servicesContainer.innerHTML = `
            <div class="service-entry" data-index="0">
                <div class="service-header">
                    <h4>Prestazione 1</h4>
                </div>
                <div class="form-group">
                    <label class="form-label">Tipologia Prestazione</label>
                    <input type="text" class="form-control service-type" placeholder="Descrizione della prestazione" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Quantità </label>
                        <input type="number" class="form-control service-quantity" min="1" step="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Importo (EUR)</label>
                        <input type="number" class="form-control service-amount" min="0" step="0.01" placeholder="0.00" required>
                    </div>
                </div>
            </div>
        `;
    }
    
    serviceCounter = 1;
    
    // Reset date and invoice number
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoice-date').value = today;
    document.getElementById('invoice-number').value = generateInvoiceNumber(invoiceCounter, invoiceYear);
    
    // Clear field borders
    document.querySelectorAll('.form-control').forEach(field => {
        field.style.borderColor = '';
    });
    
    updatePreview();
    showNotification('Form resettato con successo', 'success');
}

// Management page functions
function updateManagementView() {
    updateInvoicesList();
    updatePatientsList();
    updateManagementStats();
}

function updateManagementStats() {
    document.getElementById('invoices-count').textContent = invoices.length;
    document.getElementById('patients-count').textContent = patients.length;
    
    const syncCode = getUserSyncCode(currentUser);
    document.getElementById('header-sync-code').textContent = syncCode ? syncCode.substr(-8) : '---';
}

function updateInvoicesList() {
    const container = document.getElementById('saved-invoices');
    if (!container) return;
    
    if (invoices.length === 0) {
        container.innerHTML = '<p class="no-data">Nessuna fattura salvata</p>';
        return;
    }
    
    let html = '';
    invoices.forEach(invoice => {
        const date = new Date(invoice.date).toLocaleDateString('it-IT');
        const total = invoice.total.toFixed(2).replace('.', ',');
        
        html += `
            <div class="data-item">
                <h4>Fattura N. ${invoice.number}</h4>
                <p><strong>Paziente:</strong> ${invoice.patient.title} ${invoice.patient.name}</p>
                <p><strong>Data:</strong> ${date}</p>
                <p><strong>Totale:</strong> ${total} EUR</p>
                <p><strong>Servizi:</strong> ${invoice.services.length}</p>
                <div class="data-item-actions">
                    <button class="btn btn--sm btn--secondary" onclick="viewInvoice(${invoice.id})">Visualizza</button>
                    <button class="btn btn--sm btn--outline" onclick="deleteInvoice(${invoice.id})">Elimina</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updatePatientsList() {
    const container = document.getElementById('saved-patients');
    if (!container) return;
    
    if (patients.length === 0) {
        container.innerHTML = '<p class="no-data">Nessun paziente salvato</p>';
        return;
    }
    
    let html = '';
    patients.forEach(patient => {
        html += `
            <div class="data-item">
                <h4>${patient.title} ${patient.name}</h4>
                <p><strong>Indirizzo:</strong> ${patient.address}</p>
                <p><strong>Codice Fiscale:</strong> ${patient.tax_code}</p>
                <div class="data-item-actions">
                    <button class="btn btn--sm btn--secondary" onclick="loadPatient(${patient.id})">Carica</button>
                    <button class="btn btn--sm btn--outline" onclick="deletePatient(${patient.id})">Elimina</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function viewInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) {
        showNotification('Fattura non trovata', 'error');
        return;
    }
    
    showPage('generator');
    
    // Load invoice data
    document.getElementById('patient-title').value = invoice.patient.title;
    document.getElementById('patient-name').value = invoice.patient.name;
    document.getElementById('patient-address').value = invoice.patient.address;
    document.getElementById('patient-cf').value = invoice.patient.tax_code;
    document.getElementById('invoice-number').value = invoice.number;
    document.getElementById('invoice-date').value = invoice.date;
    document.getElementById('traced-payment').checked = invoice.tracedPayment;
    
    // Load services
    const servicesContainer = document.getElementById('services-container');
    if (servicesContainer) {
        servicesContainer.innerHTML = '';
        
        invoice.services.forEach((service, index) => {
            const serviceEntry = document.createElement('div');
            serviceEntry.className = 'service-entry';
            serviceEntry.setAttribute('data-index', index.toString());
            
            serviceEntry.innerHTML = `
                <div class="service-header">
                    <h4>Prestazione ${index + 1}</h4>
                    ${index > 0 ? '<button type="button" class="remove-service">Rimuovi</button>' : ''}
                </div>
                <div class="form-group">
                    <label class="form-label">Tipologia Prestazione</label>
                    <input type="text" class="form-control service-type" value="${service.type}" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Quantità </label>
                        <input type="number" class="form-control service-quantity" min="1" step="1" value="${service.quantity}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Importo (EUR)</label>
                        <input type="number" class="form-control service-amount" min="0" step="0.01" value="${service.amount}" required>
                    </div>
                </div>
            `;
            
            servicesContainer.appendChild(serviceEntry);
        });
        
        serviceCounter = invoice.services.length;
    }
    
    updatePreview();
    showNotification(`Fattura N. ${invoice.number} caricata`, 'success');
}

function deleteInvoice(invoiceId) {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;
    
    if (confirm(`Eliminare la fattura N. ${invoice.number}?`)) {
        invoices = invoices.filter(inv => inv.id !== invoiceId);
        saveUserData();
        updateManagementView();
        showNotification('Fattura eliminata', 'success');
    }
}

function loadPatient(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) {
        showNotification('Paziente non trovato', 'error');
        return;
    }
    
    showPage('generator');
    
    document.getElementById('patient-title').value = patient.title;
    document.getElementById('patient-name').value = patient.name;
    document.getElementById('patient-address').value = patient.address;
    document.getElementById('patient-cf').value = patient.tax_code;
    
    updatePreview();
    showNotification(`Paziente ${patient.name} caricato`, 'success');
}

function deletePatient(patientId) {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    if (confirm(`Eliminare il paziente ${patient.name}?`)) {
        patients = patients.filter(p => p.id !== patientId);
        updatePatientSelect();
        saveUserData();
        updateManagementView();
        showNotification('Paziente eliminato', 'success');
    }
}

// Export/Import functions
function exportUserData() {
    const syncCode = getUserSyncCode(currentUser);
    const exportData = {
        version: '2.0',
        username: currentUser,
        syncCode: syncCode,
        doctor: currentDoctorInfo,
        patients,
        invoices,
        counters: { invoice: invoiceCounter, service: serviceCounter, year: invoiceYear },
        exportDate: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `fatture_${currentUser}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('Dati esportati con successo', 'success');
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            if (importData.version === '2.0' && importData.syncCode) {
                // New format with sync code
                if (importData.username && confirm(`Importare i dati dell'utente "${importData.username}"?`)) {
                    // Load as new user or merge with existing
                    const existingUser = getUserProfiles().includes(importData.username);
                    
                    if (existingUser && !confirm('Utente già  esistente. Sovrascrivere i dati?')) {
                        return;
                    }
                    
                    // Import all data
                    currentUser = importData.username;
                    currentDoctorInfo = importData.doctor || {...defaultDoctorInfo};
                    patients = importData.patients || [];
                    invoices = importData.invoices || [];
                    invoiceCounter = importData.counters?.invoice || 1;
                    serviceCounter = importData.counters?.service || 1;
                    
                    // Save imported data
                    localStorage.setItem('current_user', currentUser);
                    saveUserSyncCode(importData.syncCode);
                    saveUserData();
                    
                    updateUserInterface();
                    updateManagementView();
                    initializeInvoiceForm();
                    
                    showNotification(`Dati di ${currentUser} importati con successo`, 'success');
                }
            } else {
                // Old format - merge data
                if (importData.patients && Array.isArray(importData.patients)) {
                    const newPatients = importData.patients.filter(ip => 
                        !patients.some(p => p.name === ip.name && p.tax_code === ip.tax_code)
                    );
                    patients = [...patients, ...newPatients];
                }
                
                if (importData.invoices && Array.isArray(importData.invoices)) {
                    const newInvoices = importData.invoices.filter(ii => 
                        !invoices.some(i => i.number === ii.number)
                    );
                    invoices = [...invoices, ...newInvoices];
                    
                    if (newInvoices.length > 0) {
                        const maxInvoiceNumber = Math.max(...invoices.map(inv => parseInt(inv.number) || 0));
                        invoiceCounter = maxInvoiceNumber + 1;
                        document.getElementById('invoice-number').value = generateInvoiceNumber(invoiceCounter, invoiceYear);
                    }
                }
                
                saveUserData();
                updatePatientSelect();
                updateManagementView();
                
                showNotification('Dati importati con successo (formato compatibilità )', 'success');
            }
            
        } catch (error) {
            console.error('Import error:', error);
            showNotification('Errore nell\'importazione dei dati', 'error');
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

// Utility functions
function showNotification(message, type = 'info') {
    // Remove any existing notifications
    document.querySelectorAll('.notification').forEach(notification => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#22c55e';
            break;
        case 'error':
            notification.style.backgroundColor = '#ef4444';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f59e0b';
            break;
        default:
            notification.style.backgroundColor = '#3b82f6';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Fade in
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}
