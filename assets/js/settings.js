// Settings JavaScript
let currentSettings = {};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('settings').then(hasPermission => {
                if (hasPermission) {
                    initializeSettings();
                }
            });
        }
    }, 500);
});

function initializeSettings() {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('settings.html');
    
    // Load settings
    loadSettings();
    
    // Initialize theme selector
    initializeThemeSelector();
    
    // Load system information
    loadSystemInfo();
    
    // Check WebSocket status
    checkWebSocketStatus();
}

async function loadSettings() {
    try {
        // Load settings from localStorage and server
        const localSettings = JSON.parse(localStorage.getItem('fishProSettings') || '{}');
        
        // Set default values
        const defaultSettings = {
            companyName: 'Fish Pro',
            currency: 'PHP',
            timezone: 'Asia/Manila',
            dateFormat: 'MM/DD/YYYY',
            language: 'en',
            itemsPerPage: '25',
            enableNotifications: true,
            inventoryAlerts: true,
            reportNotifications: true,
            userActivityAlerts: true,
            systemAlerts: true,
            emailNotifications: false,
            sidebarBehavior: 'auto',
            animationSpeed: 'normal',
            sessionTimeout: '120',
            passwordPolicy: 'medium',
            requirePasswordChange: false,
            enableTwoFactor: false,
            logUserActivity: true,
            enableLoginAttempts: true
        };
        
        currentSettings = { ...defaultSettings, ...localSettings };
        
        // Apply settings to form
        applySettingsToForm();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        showSettingsError('Error loading settings');
    }
}

function applySettingsToForm() {
    // General Settings
    document.getElementById('companyName').value = currentSettings.companyName;
    document.getElementById('currency').value = currentSettings.currency;
    document.getElementById('timezone').value = currentSettings.timezone;
    document.getElementById('dateFormat').value = currentSettings.dateFormat;
    document.getElementById('language').value = currentSettings.language;
    document.getElementById('itemsPerPage').value = currentSettings.itemsPerPage;
    
    // Notification Settings
    document.getElementById('enableNotifications').checked = currentSettings.enableNotifications;
    document.getElementById('inventoryAlerts').checked = currentSettings.inventoryAlerts;
    document.getElementById('reportNotifications').checked = currentSettings.reportNotifications;
    document.getElementById('userActivityAlerts').checked = currentSettings.userActivityAlerts;
    document.getElementById('systemAlerts').checked = currentSettings.systemAlerts;
    document.getElementById('emailNotifications').checked = currentSettings.emailNotifications;
    
    // Appearance Settings
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.querySelector(`input[name="theme"][value="${currentTheme}"]`).checked = true;
    document.getElementById('sidebarBehavior').value = currentSettings.sidebarBehavior;
    document.getElementById('animationSpeed').value = currentSettings.animationSpeed;
    
    // Security Settings
    document.getElementById('sessionTimeout').value = currentSettings.sessionTimeout;
    document.getElementById('passwordPolicy').value = currentSettings.passwordPolicy;
    document.getElementById('requirePasswordChange').checked = currentSettings.requirePasswordChange;
    document.getElementById('enableTwoFactor').checked = currentSettings.enableTwoFactor;
    document.getElementById('logUserActivity').checked = currentSettings.logUserActivity;
    document.getElementById('enableLoginAttempts').checked = currentSettings.enableLoginAttempts;
}

function initializeThemeSelector() {
    const themeInputs = document.querySelectorAll('input[name="theme"]');
    themeInputs.forEach(input => {
        input.addEventListener('change', function() {
            if (this.checked) {
                const newTheme = this.value;
                document.body.setAttribute('data-theme', newTheme);
                localStorage.setItem('theme', newTheme);
                
                // Update theme toggle icon
                const themeToggle = document.querySelector('.theme-toggle i');
                if (themeToggle) {
                    themeToggle.className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
                }
                
                showSettingsSuccess('Theme changed successfully!');
            }
        });
    });
}

// Save Functions
async function saveGeneralSettings() {
    try {
        const formData = {
            companyName: document.getElementById('companyName').value,
            currency: document.getElementById('currency').value,
            timezone: document.getElementById('timezone').value,
            dateFormat: document.getElementById('dateFormat').value,
            language: document.getElementById('language').value,
            itemsPerPage: document.getElementById('itemsPerPage').value
        };
        
        // Update current settings
        Object.assign(currentSettings, formData);
        
        // Save to localStorage
        localStorage.setItem('fishProSettings', JSON.stringify(currentSettings));
        
        showSettingsSuccess('General settings saved successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'General settings updated'
            });
        }
        
    } catch (error) {
        console.error('Error saving general settings:', error);
        showSettingsError('Error saving general settings');
    }
}

async function saveNotificationSettings() {
    try {
        const formData = {
            enableNotifications: document.getElementById('enableNotifications').checked,
            inventoryAlerts: document.getElementById('inventoryAlerts').checked,
            reportNotifications: document.getElementById('reportNotifications').checked,
            userActivityAlerts: document.getElementById('userActivityAlerts').checked,
            systemAlerts: document.getElementById('systemAlerts').checked,
            emailNotifications: document.getElementById('emailNotifications').checked
        };
        
        // Update current settings
        Object.assign(currentSettings, formData);
        
        // Save to localStorage
        localStorage.setItem('fishProSettings', JSON.stringify(currentSettings));
        
        showSettingsSuccess('Notification settings saved successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'Notification settings updated'
            });
        }
        
    } catch (error) {
        console.error('Error saving notification settings:', error);
        showSettingsError('Error saving notification settings');
    }
}

async function saveAppearanceSettings() {
    try {
        const selectedTheme = document.querySelector('input[name="theme"]:checked').value;
        const formData = {
            sidebarBehavior: document.getElementById('sidebarBehavior').value,
            animationSpeed: document.getElementById('animationSpeed').value
        };
        
        // Update current settings
        Object.assign(currentSettings, formData);
        
        // Save to localStorage
        localStorage.setItem('fishProSettings', JSON.stringify(currentSettings));
        localStorage.setItem('theme', selectedTheme);
        
        // Apply theme
        document.body.setAttribute('data-theme', selectedTheme);
        
        showSettingsSuccess('Appearance settings saved successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'Appearance settings updated'
            });
        }
        
    } catch (error) {
        console.error('Error saving appearance settings:', error);
        showSettingsError('Error saving appearance settings');
    }
}

async function saveSecuritySettings() {
    try {
        const formData = {
            sessionTimeout: document.getElementById('sessionTimeout').value,
            passwordPolicy: document.getElementById('passwordPolicy').value,
            requirePasswordChange: document.getElementById('requirePasswordChange').checked,
            enableTwoFactor: document.getElementById('enableTwoFactor').checked,
            logUserActivity: document.getElementById('logUserActivity').checked,
            enableLoginAttempts: document.getElementById('enableLoginAttempts').checked
        };
        
        // Update current settings
        Object.assign(currentSettings, formData);
        
        // Save to localStorage
        localStorage.setItem('fishProSettings', JSON.stringify(currentSettings));
        
        showSettingsSuccess('Security settings saved successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'Security settings updated'
            });
        }
        
    } catch (error) {
        console.error('Error saving security settings:', error);
        showSettingsError('Error saving security settings');
    }
}

// System Information Functions
async function loadSystemInfo() {
    try {
        // Get database version
        const response = await fetch('api/auth.php?action=system_info');
        const result = await response.json();
        
        if (result.success && result.data) {
            document.getElementById('dbVersion').textContent = result.data.mysql_version || 'Unknown';
        } else {
            document.getElementById('dbVersion').textContent = 'Unable to fetch';
        }
        
        // Calculate storage (mock data for now)
        setTimeout(() => {
            document.getElementById('storageUsed').textContent = '2.3 MB / 100 MB (2.3%)';
        }, 1000);
        
    } catch (error) {
        console.error('Error loading system info:', error);
        document.getElementById('dbVersion').textContent = 'Error loading';
        document.getElementById('storageUsed').textContent = 'Error calculating';
    }
}

function checkWebSocketStatus() {
    const indicator = document.getElementById('wsIndicator');
    const statusText = document.getElementById('wsStatusText');
    
    if (window.wsManager && wsManager.isConnected()) {
        indicator.className = 'status-indicator online';
        statusText.textContent = 'Connected';
    } else {
        indicator.className = 'status-indicator offline';
        statusText.textContent = 'Disconnected';
    }
    
    // Check again in 5 seconds
    setTimeout(checkWebSocketStatus, 5000);
}

// System Actions
async function testConnection() {
    try {
        showSettingsInfo('Testing connection...');
        
        const response = await fetch('api/auth.php?action=test');
        const result = await response.json();
        
        if (result.success) {
            showSettingsSuccess('Connection test successful!');
        } else {
            showSettingsError('Connection test failed');
        }
    } catch (error) {
        console.error('Connection test error:', error);
        showSettingsError('Connection test failed');
    }
}

function clearCache() {
    try {
        // Clear localStorage except for essential items
        const essentialKeys = ['theme', 'fishProSettings'];
        const allKeys = Object.keys(localStorage);
        
        allKeys.forEach(key => {
            if (!essentialKeys.includes(key)) {
                localStorage.removeItem(key);
            }
        });
        
        // Clear session storage
        sessionStorage.clear();
        
        showSettingsSuccess('Cache cleared successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'System cache cleared'
            });
        }
        
    } catch (error) {
        console.error('Error clearing cache:', error);
        showSettingsError('Error clearing cache');
    }
}

async function exportData() {
    try {
        showSettingsInfo('Preparing data export...');
        
        // Collect data from different endpoints
        const endpoints = [
            'api/daily_reports.php',
            'api/inventory.php',
            'api/users.php'
        ];
        
        const exportData = {
            timestamp: new Date().toISOString(),
            version: 'Fish Pro v1.0.0',
            data: {}
        };
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                const result = await response.json();
                
                if (result.success && result.data) {
                    const dataType = endpoint.split('/')[1].replace('.php', '');
                    exportData.data[dataType] = result.data;
                }
            } catch (error) {
                console.warn(`Failed to export data from ${endpoint}:`, error);
            }
        }
        
        // Add settings
        exportData.settings = currentSettings;
        
        // Create and download file
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `fish-pro-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        showSettingsSuccess('Data exported successfully!');
        
        // Send WebSocket notification
        if (window.wsManager) {
            wsManager.sendUserActivity({
                message: 'System data exported'
            });
        }
        
    } catch (error) {
        console.error('Error exporting data:', error);
        showSettingsError('Error exporting data');
    }
}

// Utility Functions
function showSettingsSuccess(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'success');
    } else {
        alert(message);
    }
}

function showSettingsError(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'danger');
    } else {
        alert(message);
    }
}

function showSettingsInfo(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'info');
    } else {
        alert(message);
    }
}
