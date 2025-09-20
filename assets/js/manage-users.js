// User Management JavaScript
let allUsers = [];
let currentEditingUser = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('manage_users').then(hasPermission => {
                if (hasPermission) {
                    initializeUserManagement();
                }
            });
        }
    }, 500);
});

function initializeUserManagement() {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('manage-users.html');
    
    // Load initial data
    loadUsersData();
    
    // Add event listeners
    document.getElementById('searchUsers').addEventListener('input', searchUsers);
    document.getElementById('newRole').addEventListener('change', handleRoleChange);
    document.getElementById('editRole').addEventListener('change', handleEditRoleChange);
}

async function loadUsersData() {
    try {
        const response = await fetch('api/users.php');
        const result = await response.json();
        
        if (result.success && result.data) {
            allUsers = result.data;
            updateUsersTable();
            updateUserStats();
        } else {
            showUserError('Failed to load users data');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showUserError('Error loading users data');
    }
}

function updateUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = allUsers.map(user => {
        const permissions = JSON.parse(user.permissions || '[]');
        const createdDate = new Date(user.created_at).toLocaleDateString();
        const statusClass = user.is_active ? 'success' : 'danger';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const roleClass = user.role === 'admin' ? 'primary' : 'secondary';
        
        return `
            <tr>
                <td>
                    <strong>${user.username}</strong>
                    ${user.role === 'admin' ? '<i class="fas fa-crown text-warning" title="Admin"></i>' : ''}
                </td>
                <td>
                    <span class="badge" style="background: var(--${roleClass}-color); color: white; padding: 4px 8px; border-radius: 12px;">
                        <i class="fas ${user.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i>
                        ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="permissions-display">
                        ${permissions.length} sections
                        <button class="btn btn-sm btn-info" onclick="showUserPermissions('${user.username}', '${user.permissions}')" title="View Permissions">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <span class="badge" style="background: var(--${statusClass}-color); color: white; padding: 4px 8px; border-radius: 12px;">
                        <i class="fas ${user.is_active ? 'fa-check' : 'fa-times'}"></i>
                        ${statusText}
                    </span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function updateUserStats() {
    const totalUsers = allUsers.length;
    const adminUsers = allUsers.filter(user => user.role === 'admin').length;
    const activeUsers = allUsers.filter(user => user.is_active).length;
    
    document.getElementById('totalUsers').textContent = totalUsers;
    document.getElementById('adminUsers').textContent = adminUsers;
    document.getElementById('activeUsers').textContent = activeUsers;
}

// Modal Functions
function showAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.remove('show');
    document.getElementById('addUserForm').reset();
    resetPermissionCheckboxes();
}

function showEditUserModal() {
    document.getElementById('editUserModal').classList.add('show');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
    document.getElementById('editUserForm').reset();
    currentEditingUser = null;
}

// Permission Management
function handleRoleChange() {
    const role = document.getElementById('newRole').value;
    const checkboxes = document.querySelectorAll('.permission-checkbox');
    
    if (role === 'admin') {
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            checkbox.disabled = true;
        });
    } else {
        checkboxes.forEach(checkbox => {
            checkbox.disabled = false;
        });
    }
}

function handleEditRoleChange() {
    const role = document.getElementById('editRole').value;
    const checkboxes = document.querySelectorAll('.edit-permission-checkbox');
    
    if (role === 'admin') {
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            checkbox.disabled = true;
        });
    } else {
        checkboxes.forEach(checkbox => {
            checkbox.disabled = false;
        });
    }
}

function resetPermissionCheckboxes() {
    const checkboxes = document.querySelectorAll('.permission-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.disabled = false;
    });
}

function getSelectedPermissions(checkboxClass) {
    const checkboxes = document.querySelectorAll(`.${checkboxClass}:checked`);
    const permissions = Array.from(checkboxes).map(cb => cb.value);    
    return permissions;
}

function setUserPermissions(permissions) {
    const permissionArray = JSON.parse(permissions || '[]');
    const checkboxes = document.querySelectorAll('.edit-permission-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = permissionArray.includes(checkbox.value);
    });
}

// CRUD Operations
async function saveNewUser() {
    const formData = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value,
        permissions: getSelectedPermissions('permission-checkbox')
    };
    
    if (!formData.username || !formData.password) {
        showUserError('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('api/users.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showUserSuccess('User created successfully!');
            closeAddUserModal();
            loadUsersData();
            
            // Send WebSocket notification
            if (window.wsManager) {
                wsManager.sendUserActivity({
                    message: `New user created: ${formData.username}`
                });
            }
        } else {
            showUserError(result.message || 'Failed to create user');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showUserError('Error creating user');
    }
}

async function editUser(userId) {
    try {
        const response = await fetch(`api/users.php?action=single&id=${userId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            currentEditingUser = result.data;
            
            document.getElementById('editUserId').value = result.data.id;
            document.getElementById('editUsername').value = result.data.username;
            document.getElementById('editRole').value = result.data.role;
            document.getElementById('editPassword').value = '';
            
            setUserPermissions(result.data.permissions);
            handleEditRoleChange();
            
            showEditUserModal();
        } else {
            showUserError('Failed to load user data');
        }
    } catch (error) {
        console.error('Error loading user:', error);
        showUserError('Error loading user data');
    }
}

async function saveEditedUser() {
    const formData = {
        id: document.getElementById('editUserId').value,
        username: document.getElementById('editUsername').value,
        role: document.getElementById('editRole').value,
        permissions: getSelectedPermissions('edit-permission-checkbox')
    };
    
    const password = document.getElementById('editPassword').value;
    if (password) {
        formData.password = password;
    }
    
    if (!formData.username) {
        showUserError('Please fill in all required fields');
        return;
    }
    
    try {
        const response = await fetch('api/users.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showUserSuccess('User updated successfully!');
            closeEditUserModal();
            loadUsersData();
            
            // Send WebSocket notification
            if (window.wsManager) {
                wsManager.sendUserActivity({
                    message: `User updated: ${formData.username}`
                });
            }
        } else {
            showUserError(result.message || 'Failed to update user');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showUserError('Error updating user');
    }
}

async function deleteUser(userId) {
    const user = allUsers.find(u => u.id == userId);
    if (!user) return;
    
    if (user.username === 'admin') {
        showUserError('Cannot delete the admin user');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete user "${user.username}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`api/users.php?id=${userId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showUserSuccess('User deleted successfully!');
            loadUsersData();
            
            // Send WebSocket notification
            if (window.wsManager) {
                wsManager.sendUserActivity({
                    message: `User deleted: ${user.username}`
                });
            }
        } else {
            showUserError(result.message || 'Failed to delete user');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showUserError('Error deleting user');
    }
}

// Search and Display Functions
function searchUsers() {
    const searchTerm = document.getElementById('searchUsers').value.toLowerCase();
    const filteredUsers = allUsers.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.role.toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('usersTableBody');
    
    if (filteredUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredUsers.map(user => {
        const permissions = JSON.parse(user.permissions || '[]');
        const createdDate = new Date(user.created_at).toLocaleDateString();
        const statusClass = user.is_active ? 'success' : 'danger';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        const roleClass = user.role === 'admin' ? 'primary' : 'secondary';
        
        return `
            <tr>
                <td>
                    <strong>${user.username}</strong>
                    ${user.role === 'admin' ? '<i class="fas fa-crown text-warning" title="Admin"></i>' : ''}
                </td>
                <td>
                    <span class="badge" style="background: var(--${roleClass}-color); color: white; padding: 4px 8px; border-radius: 12px;">
                        <i class="fas ${user.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i>
                        ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                </td>
                <td>
                    <div class="permissions-display">
                        ${permissions.length} sections
                        <button class="btn btn-sm btn-info" onclick="showUserPermissions('${user.username}', '${user.permissions}')" title="View Permissions">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <span class="badge" style="background: var(--${statusClass}-color); color: white; padding: 4px 8px; border-radius: 12px;">
                        <i class="fas ${user.is_active ? 'fa-check' : 'fa-times'}"></i>
                        ${statusText}
                    </span>
                </td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editUser(${user.id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})" title="Delete User">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function showUserPermissions(username, permissionsJson) {
    const permissions = JSON.parse(permissionsJson || '[]');
    const permissionNames = {
        'dashboard': 'Dashboard',
        'daily_report': 'Daily Fish Report',
        'ms3_msr': 'MS3 & MSR',
        's3': 'S3',
        'msr': 'MSR',
        'inventory': 'Inventory',
        'manage_users': 'Manage Users',
        'settings': 'Settings'
    };
    
    const permissionList = permissions.map(perm => 
        `<li><i class="fas fa-check text-success"></i> ${permissionNames[perm] || perm}</li>`
    ).join('');
    
    const content = `
        <div style="background: var(--card-color); border-radius: var(--border-radius); box-shadow: var(--shadow); padding: 20px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 2000; min-width: 300px; max-width: 500px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                <h4 style="margin: 0; color: var(--text-color);">Permissions for ${username}</h4>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 20px; color: var(--text-muted); cursor: pointer;">&times;</button>
            </div>
            <ul style="list-style: none; padding: 0; margin: 0;">
                ${permissionList}
            </ul>
        </div>
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1999;" onclick="this.nextElementSibling.remove(); this.remove();"></div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', content);
}

// Utility Functions
function showUserSuccess(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'success');
    } else {
        alert(message);
    }
}

function showUserError(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'danger');
    } else {
        alert(message);
    }
}
