// Authentication JavaScript
const API_BASE = 'api/';

// Login function
async function login(username, password) {
    try {
        const response = await fetch(API_BASE + 'auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login',
                username: username,
                password: password
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: 'Connection error' };
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch(API_BASE + 'auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'logout'
            })
        });

        const result = await response.json();
        if (result.success) {
            window.location.href = 'index.html';
        }
        return result;
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, message: 'Connection error' };
    }
}

// Check session function
async function checkSession() {
    try {
        const response = await fetch(API_BASE + 'auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'check_session'
            })
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Session check error:', error);
        return { success: false };
    }
}

// Check permission function
async function checkPermission(section) {
    try {
        const response = await fetch(API_BASE + 'auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'check_permission',
                section: section
            })
        });

        const result = await response.json();
        return result.hasPermission;
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Show alert function
function showAlert(message, type = 'danger') {
    const alertDiv = document.getElementById('loginAlert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
}

// Login form handler
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            // Show loading state
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<div class="spinner"></div> Logging in...';
            submitBtn.disabled = true;
            
           try {
                const result = await login(username, password);

                if (result.success) {
                    showAlert('Login successful! Redirecting...', 'success');

                    setTimeout(() => {
                        const permissions = result.user.permissions || [];

                        // Define mapping between permission and page
                        const pageMap = {
                            dashboard: 'dashboard.html',
                            daily_report: 'daily-report.html',
                            ms3_msr: 'ms3-msr.html',
                            s3: 's3.html',
                            msr: 'msr.html',
                            inventory: 'inventory.html',
                            user_management: 'manage-users.html',
                            setting: 'settings.html'
                        };

                        // Find the first permission that has a mapped page
                        let redirectPage = 'dashboard.html'; // fallback
                        for (let perm of permissions) {
                            if (pageMap[perm]) {
                                redirectPage = pageMap[perm];
                                break;
                            }
                        }

                        window.location.href = redirectPage;
                    }, 1000);
                } else {
                    showAlert(result.message || 'Login failed');
                }
            } catch (error) {
                showAlert('Connection error. Please try again.');
            } finally {
                // Reset button state
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }
        });
    }
});

// Protect pages that require authentication
function requireAuth() {
    checkSession().then(result => {
        if (!result.success) {
            window.location.href = 'index.html';
        } else {
            // Store user info globally
            window.currentUser = result.user;
        }
    });
}

// Check if user has access to a section
async function requirePermission(section) {
    const hasPermission = await checkPermission(section);
    if (!hasPermission) {
        showNoAccessMessage();
        return false;
    }
    return true;
}

// Show no access message
function showNoAccessMessage() {
    const content = document.querySelector('.content');
    if (content) {
        content.innerHTML = `
            <div class="card text-center">
                <div class="card-body">
                    <i class="fas fa-lock" style="font-size: 4rem; color: var(--danger-color); margin-bottom: 20px;"></i>
                    <h2>Access Denied</h2>
                    <p class="text-muted">No access, please contact the developer</p>
                    <button class="btn btn-primary" onclick="window.location.href='dashboard.html'">
                        <i class="fas fa-home"></i> Back to Dashboard
                    </button>
                </div>
            </div>
        `;
    }
}
