// Inventory Management JavaScript
let inventoryItems = [];
let currentEditingItem = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('inventory').then(hasPermission => {
                if (hasPermission) {
                    initializeInventory();
                }
            });
        }
    }, 500);
});

function initializeInventory() {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('inventory.html');
    
    // Load initial data
    loadInventoryData();
    loadStockAlerts();
    
    // Add event listeners
    document.getElementById('updateItemSelect').addEventListener('change', updateCurrentStockDisplay);
    document.getElementById('searchInventory').addEventListener('input', searchInventory);
}

async function loadInventoryData() {
    try {
        const response = await fetch('api/inventory.php');
        const result = await response.json();
        
        if (result.success && result.data) {
            inventoryItems = result.data;
            updateInventoryTable();
            populateItemSelects();
        } else {
            showInventoryError('Failed to load inventory data');
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        showInventoryError('Error loading inventory data');
    }
}

async function loadStockAlerts() {
    try {
        const response = await fetch('api/inventory.php?action=alerts');
        const result = await response.json();
        
        if (result.success && result.data) {
            updateStockAlerts(result.data);
        }
    } catch (error) {
        console.error('Error loading stock alerts:', error);
    }
}

function updateInventoryTable() {
    const tbody = document.getElementById('inventoryTableBody');
    
    if (inventoryItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No inventory items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = inventoryItems.map(item => {
        const stockStatus = getStockStatus(item.current_stock, item.min_threshold);
        const lastUpdated = new Date(item.last_updated).toLocaleDateString();
        
        return `
            <tr>
                <td>
                    <strong>${item.item_name}</strong>
                </td>
                <td>
                    <span class="stock-value">${item.current_stock}</span>
                </td>
                <td>${item.unit}</td>
                <td>${item.min_threshold}</td>
                <td>${formatCurrency(item.cost_per_unit)}</td>
                <td>
                    <span class="stock-status ${stockStatus.class}">
                        <i class="fas ${stockStatus.icon}"></i>
                        ${stockStatus.text}
                    </span>
                </td>
                <td>${lastUpdated}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editItem(${item.id})" title="Edit Item">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="quickStockUpdate(${item.id})" title="Quick Stock Update">
                        <i class="fas fa-plus-minus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})" title="Delete Item">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updateStockAlerts(alerts) {
    const alertsContainer = document.getElementById('stockAlerts');
    const alertCount = document.getElementById('alertCount');
    
    alertCount.textContent = alerts.length;
    
    if (alerts.length === 0) {
        alertsContainer.innerHTML = '<p class="text-center text-success"><i class="fas fa-check-circle"></i> All inventory levels are good</p>';
        document.getElementById('stockAlertsCard').style.display = 'none';
        return;
    }
    
    document.getElementById('stockAlertsCard').style.display = 'block';
    
    alertsContainer.innerHTML = alerts.map(item => {
        const statusClass = item.current_stock === 0 ? 'danger' : 'warning';
        const statusText = item.current_stock === 0 ? 'Out of Stock' : 'Low Stock';
        const statusIcon = item.current_stock === 0 ? 'fa-times-circle' : 'fa-exclamation-triangle';
        
        return `
            <div class="alert alert-${statusClass}" style="margin-bottom: 10px;">
                <div class="d-flex justify-between align-center">
                    <div>
                        <strong><i class="fas ${statusIcon}"></i> ${item.item_name}</strong>
                        <div class="text-muted">Current: ${item.current_stock} ${item.unit} | Minimum: ${item.min_threshold} ${item.unit}</div>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-primary" onclick="quickStockUpdate(${item.id})">
                            <i class="fas fa-plus"></i> Add Stock
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Send WebSocket alert for critical items
    alerts.forEach(item => {
        if (item.current_stock === 0 && window.wsManager) {
            wsManager.sendInventoryAlert({
                item_name: item.item_name,
                current_stock: item.current_stock,
                min_threshold: item.min_threshold
            });
        }
    });
}

function getStockStatus(currentStock, minThreshold) {
    if (currentStock === 0) {
        return { class: 'out', text: 'Out of Stock', icon: 'fa-times-circle' };
    } else if (currentStock <= minThreshold) {
        return { class: 'low', text: 'Low Stock', icon: 'fa-exclamation-triangle' };
    } else {
        return { class: 'good', text: 'Good', icon: 'fa-check-circle' };
    }
}

function populateItemSelects() {
    const select = document.getElementById('updateItemSelect');
    select.innerHTML = '<option value="">Select an item...</option>';
    
    inventoryItems.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${item.item_name} (${item.current_stock} ${item.unit})`;
        option.dataset.currentStock = item.current_stock;
        select.appendChild(option);
    });
}

function updateCurrentStockDisplay() {
    const select = document.getElementById('updateItemSelect');
    const currentStockInput = document.getElementById('currentStockDisplay');
    
    if (select.value) {
        const selectedOption = select.options[select.selectedIndex];
        currentStockInput.value = selectedOption.dataset.currentStock;
    } else {
        currentStockInput.value = '';
    }
}

// Modal Functions
function showAddItemModal() {
    document.getElementById('addItemModal').classList.add('show');
}

function closeAddItemModal() {
    document.getElementById('addItemModal').classList.remove('show');
    document.getElementById('addItemForm').reset();
}

function showStockUpdateModal() {
    populateItemSelects();
    document.getElementById('stockUpdateModal').classList.add('show');
}

function closeStockUpdateModal() {
    document.getElementById('stockUpdateModal').classList.remove('show');
    document.getElementById('stockUpdateForm').reset();
}

function showEditItemModal() {
    document.getElementById('editItemModal').classList.add('show');
}

function closeEditItemModal() {
    document.getElementById('editItemModal').classList.remove('show');
    document.getElementById('editItemForm').reset();
    currentEditingItem = null;
}

// CRUD Operations
async function saveNewItem() {
    // Validate form inputs
    const selectedItemName = document.getElementById('newItemName').value.trim();
    const stockValue = document.getElementById('newItemStock').value;
    const unitValue = document.getElementById('newItemUnit').value;
    const thresholdValue = document.getElementById('newItemThreshold').value;
    const costValue = document.getElementById('newItemCost').value;
    
    // Check for empty fields
    if (!selectedItemName || !stockValue || !unitValue || !thresholdValue || !costValue) {
        showInventoryError('Please fill in all required fields.');
        return;
    }
    
    // Validate numeric values
    const stock = parseInt(stockValue);
    const threshold = parseInt(thresholdValue);
    const cost = parseFloat(costValue);
    
    if (isNaN(stock) || stock < 0) {
        showInventoryError('Please enter a valid stock quantity (0 or greater).');
        return;
    }
    
    if (isNaN(threshold) || threshold < 0) {
        showInventoryError('Please enter a valid minimum threshold (0 or greater).');
        return;
    }
    
    if (isNaN(cost) || cost < 0) {
        showInventoryError('Please enter a valid cost per unit (0 or greater).');
        return;
    }
    
    // Check if item already exists
    const existingItem = inventoryItems.find(item => 
        item.item_name.toLowerCase() === selectedItemName.toLowerCase()
    );
    
    if (existingItem) {
        showInventoryError('This item already exists in inventory. Use "Update Stock" to add more.');
        return;
    }
    
    const formData = {
        item_name: selectedItemName,
        current_stock: stock,
        unit: unitValue,
        min_threshold: threshold,
        cost_per_unit: cost
    };
    
    // Show loading state
    const submitBtn = document.querySelector('#addItemModal .btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('api/inventory.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showInventorySuccess('Item added successfully!');
            closeAddItemModal();
            await loadInventoryData();
            await loadStockAlerts();
        } else {
            showInventoryError(result.message || 'Failed to add item');
        }
    } catch (error) {
        console.error('Error adding item:', error);
        showInventoryError('Network error occurred. Please check your connection and try again.');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function saveStockUpdate() {
    const itemId = document.getElementById('updateItemSelect').value;
    const action = document.getElementById('stockAction').value;
    const quantityValue = document.getElementById('stockQuantity').value;
    const notes = document.getElementById('stockNotes').value.trim();
    
    // Validate inputs
    if (!itemId) {
        showInventoryError('Please select an item.');
        return;
    }
    
    if (!action) {
        showInventoryError('Please select an action (Add or Remove).');
        return;
    }
    
    const quantity = parseInt(quantityValue);
    if (!quantityValue || isNaN(quantity) || quantity <= 0) {
        showInventoryError('Please enter a valid quantity (greater than 0).');
        return;
    }
    
    // Check if removing more than available stock
    if (action === 'remove') {
        const currentStock = parseInt(document.getElementById('currentStockDisplay').value) || 0;
        if (quantity > currentStock) {
            showInventoryError(`Cannot remove ${quantity} items. Only ${currentStock} available in stock.`);
            return;
        }
    }
    
    const quantityChange = action === 'add' ? quantity : -quantity;
    
    // Show loading state
    const submitBtn = document.querySelector('#stockUpdateModal .btn-primary');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('api/inventory.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_stock',
                id: itemId,
                quantity_change: quantityChange,
                notes: notes || `Stock ${action}: ${quantity} units`
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showInventorySuccess(`Stock ${action === 'add' ? 'added' : 'removed'} successfully!`);
            closeStockUpdateModal();
            await loadInventoryData();
            await loadStockAlerts();
        } else {
            showInventoryError(result.message || 'Failed to update stock');
        }
    } catch (error) {
        console.error('Error updating stock:', error);
        showInventoryError('Network error occurred. Please check your connection and try again.');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

async function editItem(itemId) {
    try {
        const response = await fetch(`api/inventory.php?action=single&id=${itemId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            currentEditingItem = result.data;
            
            document.getElementById('editItemId').value = result.data.id;
            document.getElementById('editItemName').value = result.data.item_name;
            document.getElementById('editItemStock').value = result.data.current_stock;
            document.getElementById('editItemUnit').value = result.data.unit;
            document.getElementById('editItemThreshold').value = result.data.min_threshold;
            document.getElementById('editItemCost').value = result.data.cost_per_unit;
            
            showEditItemModal();
        } else {
            showInventoryError('Failed to load item data');
        }
    } catch (error) {
        console.error('Error loading item:', error);
        showInventoryError('Error loading item data');
    }
}

async function saveEditedItem() {
    const formData = {
        id: document.getElementById('editItemId').value,
        item_name: document.getElementById('editItemName').value,
        current_stock: parseInt(document.getElementById('editItemStock').value),
        unit: document.getElementById('editItemUnit').value,
        min_threshold: parseInt(document.getElementById('editItemThreshold').value),
        cost_per_unit: parseFloat(document.getElementById('editItemCost').value)
    };
    
    try {
        const response = await fetch('api/inventory.php', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showInventorySuccess('Item updated successfully!');
            closeEditItemModal();
            loadInventoryData();
            loadStockAlerts();
        } else {
            showInventoryError(result.message || 'Failed to update item');
        }
    } catch (error) {
        console.error('Error updating item:', error);
        showInventoryError('Error updating item');
    }
}

async function deleteItem(itemId) {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`api/inventory.php?id=${itemId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showInventorySuccess('Item deleted successfully!');
            loadInventoryData();
            loadStockAlerts();
        } else {
            showInventoryError(result.message || 'Failed to delete item');
        }
    } catch (error) {
        console.error('Error deleting item:', error);
        showInventoryError('Error deleting item');
    }
}

function quickStockUpdate(itemId) {
    const item = inventoryItems.find(i => i.id == itemId);
    if (item) {
        document.getElementById('updateItemSelect').value = itemId;
        updateCurrentStockDisplay();
        document.getElementById('stockAction').value = 'add';
        document.getElementById('stockQuantity').value = '';
        document.getElementById('stockNotes').value = `Quick stock update for ${item.item_name}`;
        showStockUpdateModal();
    }
}

// Transaction History
async function showTransactionHistory() {
    try {
        const response = await fetch('api/inventory.php?action=transactions');
        const result = await response.json();
        
        if (result.success && result.data) {
            updateTransactionTable(result.data);
            document.getElementById('transactionHistoryCard').style.display = 'block';
            document.getElementById('transactionHistoryCard').scrollIntoView({ behavior: 'smooth' });
        } else {
            showInventoryError('Failed to load transaction history');
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
        showInventoryError('Error loading transaction history');
    }
}

function hideTransactionHistory() {
    document.getElementById('transactionHistoryCard').style.display = 'none';
}

function updateTransactionTable(transactions) {
    const tbody = document.getElementById('transactionTableBody');
    
    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No transactions found</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        const typeClass = transaction.transaction_type === 'add' ? 'success' : 
                         transaction.transaction_type === 'remove' ? 'danger' : 'info';
        const typeIcon = transaction.transaction_type === 'add' ? 'fa-plus' : 
                        transaction.transaction_type === 'remove' ? 'fa-minus' : 'fa-edit';
        
        return `
            <tr>
                <td>${date}</td>
                <td>${transaction.item_name}</td>
                <td>
                    <span class="badge" style="background: var(--${typeClass}-color); color: white; padding: 4px 8px; border-radius: 12px;">
                        <i class="fas ${typeIcon}"></i>
                        ${transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                    </span>
                </td>
                <td class="text-${typeClass}">${transaction.quantity_change > 0 ? '+' : ''}${transaction.quantity_change}</td>
                <td>${transaction.previous_stock}</td>
                <td>${transaction.new_stock}</td>
                <td>${transaction.notes || '-'}</td>
                <td>${transaction.created_by_name || 'System'}</td>
            </tr>
        `;
    }).join('');
}

// Search and Export
function searchInventory() {
    const searchTerm = document.getElementById('searchInventory').value.toLowerCase();
    const filteredItems = inventoryItems.filter(item => 
        item.item_name.toLowerCase().includes(searchTerm)
    );
    
    const tbody = document.getElementById('inventoryTableBody');
    
    if (filteredItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredItems.map(item => {
        const stockStatus = getStockStatus(item.current_stock, item.min_threshold);
        const lastUpdated = new Date(item.last_updated).toLocaleDateString();
        
        return `
            <tr>
                <td><strong>${item.item_name}</strong></td>
                <td><span class="stock-value">${item.current_stock}</span></td>
                <td>${item.unit}</td>
                <td>${item.min_threshold}</td>
                <td>${formatCurrency(item.cost_per_unit)}</td>
                <td>
                    <span class="stock-status ${stockStatus.class}">
                        <i class="fas ${stockStatus.icon}"></i>
                        ${stockStatus.text}
                    </span>
                </td>
                <td>${lastUpdated}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editItem(${item.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="quickStockUpdate(${item.id})">
                        <i class="fas fa-plus-minus"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function exportInventoryData() {
    if (inventoryItems.length === 0) {
        alert('No inventory data to export');
        return;
    }
    
    const headers = ['Item Name', 'Current Stock', 'Unit', 'Min Threshold', 'Cost per Unit', 'Status', 'Last Updated'];
    
    const csvContent = [
        headers.join(','),
        ...inventoryItems.map(item => {
            const status = getStockStatus(item.current_stock, item.min_threshold).text;
            const lastUpdated = new Date(item.last_updated).toLocaleDateString();
            
            return [
                item.item_name,
                item.current_stock,
                item.unit,
                item.min_threshold,
                item.cost_per_unit,
                status,
                lastUpdated
            ].join(',');
        })
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-pro-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Utility Functions
function showInventorySuccess(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'success');
    } else {
        alert(message);
    }
}

function showInventoryError(message) {
    if (window.wsManager) {
        wsManager.showToast(message, 'danger');
    } else {
        alert(message);
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount);
}
