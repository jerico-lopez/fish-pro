// Dashboard JavaScript
let currentUser = null;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    initializeDashboard();
});

async function initializeDashboard() {
    // Wait for authentication to complete
    setTimeout(async () => {
        if (window.currentUser) {
            currentUser = window.currentUser;
            updateUserInfo();
            updateDateTime();
            await loadDashboardStats();
            await loadRecentReports();
            await loadInventoryAlerts();
            setupNavigationPermissions();
            initializeWebSocket();
        }
    }, 500);
}

function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.username;
    }
    
    // Show manage users button for admins
    if (currentUser && currentUser.role === 'admin') {
        const manageUsersBtn = document.getElementById('manageUsersBtn');
        if (manageUsersBtn) {
            manageUsersBtn.style.display = 'inline-flex';
        }
    }
}

function updateDateTime() {
    const dateTimeElement = document.getElementById('currentDateTime');
    if (dateTimeElement) {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        dateTimeElement.textContent = now.toLocaleDateString('en-US', options);
    }
    
    // Update every minute
    setTimeout(updateDateTime, 60000);
}

async function loadDashboardStats() {
    try {
        const response = await fetch('api/daily_reports.php?action=aggregated', {
            method: 'GET'
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const data = result.data;
            
            // Update stat cards
            document.getElementById('totalReports').textContent = data.total_reports || 0;
            document.getElementById('totalBoxes').textContent = data.total_boxes || 0;
            document.getElementById('totalSales').textContent = formatCurrency(data.total_sales || 0);
            document.getElementById('netIncome').textContent = formatCurrency(data.total_net_income || 0);
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadRecentReports() {
    try {
        const response = await fetch('api/daily_reports.php?limit=5', {
            method: 'GET'
        });
        
        const result = await response.json();
        const tbody = document.getElementById('recentReports');
        
        if (result.success && result.data && result.data.length > 0) {
            tbody.innerHTML = result.data.map(report => {
                const netIncome = (report.salles || 0) - (
                    (report.cost || 0) + 
                    (report.fish || 0) + 
                    (report.ice_chest || 0) + 
                    (report.plastic || 0) + 
                    (report.tape || 0) + 
                    (report.ice || 0) + 
                    (report.labor || 0) + 
                    (report.air_cargo || 0)
                );
                
                return `
                    <tr>
                        <td>${formatDate(report.report_date)}</td>
                        <td>${report.boxes || 0}</td>
                        <td>${formatCurrency(report.salles || 0)}</td>
                        <td class="${netIncome >= 0 ? 'text-success' : 'text-danger'}">
                            ${formatCurrency(netIncome)}
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No reports found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading recent reports:', error);
        document.getElementById('recentReports').innerHTML = 
            '<tr><td colspan="4" class="text-center text-danger">Error loading reports</td></tr>';
    }
}

async function loadInventoryAlerts() {
    try {
        const response = await fetch('api/inventory.php?action=alerts', {
            method: 'GET'
        });
        
        const result = await response.json();
        const alertsContainer = document.getElementById('inventoryAlerts');
        
        if (result.success && result.data && result.data.length > 0) {
            alertsContainer.innerHTML = result.data.map(item => {
                const statusClass = item.current_stock === 0 ? 'out' : 'low';
                const statusText = item.current_stock === 0 ? 'Out of Stock' : 'Low Stock';
                
                return `
                    <div class="alert alert-${item.current_stock === 0 ? 'danger' : 'warning'}" style="margin-bottom: 10px;">
                        <div class="d-flex justify-between align-center">
                            <div>
                                <strong>${item.item_name}</strong>
                                <div class="text-muted">Current: ${item.current_stock} ${item.unit}</div>
                            </div>
                            <span class="stock-status ${statusClass}">
                                <i class="fas fa-exclamation-triangle"></i>
                                ${statusText}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            
            // Update notification badge
            updateNotificationBadge(result.data.length);
        } else {
            alertsContainer.innerHTML = '<p class="text-center text-success"><i class="fas fa-check-circle"></i> All inventory levels are good</p>';
        }
    } catch (error) {
        console.error('Error loading inventory alerts:', error);
        document.getElementById('inventoryAlerts').innerHTML = 
            '<p class="text-center text-danger">Error loading inventory alerts</p>';
    }
}

function updateInventoryAlerts() {
    loadInventoryAlerts();
}

function updateNotificationBadge(count = null) {
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (count !== null) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    }
}

async function setupNavigationPermissions() {
    const navLinks = document.querySelectorAll('.nav-link[data-permission]');
    
    for (const link of navLinks) {
        const permission = link.getAttribute('data-permission');
        const hasPermission = await checkPermission(permission);
        
        if (!hasPermission) {
            link.style.display = 'none';
        }
    }
}

// Sidebar toggle
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
}

// Theme toggle
function toggleTheme() {
    const body = document.body;
    const themeToggle = document.querySelector('.theme-toggle i');
    
    if (body.getAttribute('data-theme') === 'dark') {
        body.setAttribute('data-theme', 'light');
        themeToggle.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.setAttribute('data-theme', 'dark');
        themeToggle.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.querySelector('.theme-toggle i');
    if (themeToggle) {
        themeToggle.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
});

// Show notifications
function showNotifications() {
    // Reset notification badge
    updateNotificationBadge(0);
    
    // Show notifications modal or redirect to notifications page
    alert('Notifications feature - showing inventory alerts and recent activities');
}

// Show user menu
function showUserMenu() {
    const userMenu = `
        <div class="user-menu" style="position: absolute; top: 60px; right: 20px; background: var(--card-color); border-radius: var(--border-radius); box-shadow: var(--shadow); padding: 15px; min-width: 200px; z-index: 1000;">
            <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color);">
                <strong>${currentUser ? currentUser.username : 'User'}</strong>
                <div class="text-muted">${currentUser ? currentUser.role : 'Role'}</div>
            </div>
            <a href="settings.html" style="display: block; padding: 8px 0; color: var(--text-color); text-decoration: none;">
                <i class="fas fa-cog"></i> Settings
            </a>
            <a href="#" onclick="logout()" style="display: block; padding: 8px 0; color: var(--danger-color); text-decoration: none;">
                <i class="fas fa-sign-out-alt"></i> Logout
            </a>
        </div>
    `;
    
    // Remove existing menu
    const existingMenu = document.querySelector('.user-menu');
    if (existingMenu) {
        existingMenu.remove();
        return;
    }
    
    // Add new menu
    document.body.insertAdjacentHTML('beforeend', userMenu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!e.target.closest('.user-menu') && !e.target.closest('.user-menu-btn')) {
                const menu = document.querySelector('.user-menu');
                if (menu) menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Set active navigation
function setActiveNav(page) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    const activeLink = document.querySelector(`.nav-link[href="${page}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

// Mobile sidebar toggle
document.addEventListener('DOMContentLoaded', function() {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
        }
    }
});

// Handle window resize
window.addEventListener('resize', function() {
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 768) {
        if (sidebar && !sidebar.classList.contains('collapsed')) {
            sidebar.classList.add('show');
        }
    } else {
        if (sidebar) {
            sidebar.classList.remove('show');
        }
    }
});
