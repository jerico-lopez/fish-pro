// Daily Report JavaScript
let currentEditingReport = null;
// unit costs from inventory. with fallback values
let unitCosts = {
    'Ice Chest': 190.00,
    'Plastic': 12.00,
    'Tape': 42.00,
    'Ice': 150.00
};

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('daily_report').then(hasPermission => {
                if (hasPermission) {
                    initializeDailyReport();
                }
            });
        }
    }, 500);
});

function initializeDailyReport() {
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('daily-report.html');
    
    // Load inventory stock data
    loadInventoryStock();
    
    // Set today's date as default
    document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
    
    // Add event listeners for calculations
    addCalculationListeners();


    syncValues('boxes', 'iceChest');
}

// Sync input values
function syncValues(sourceId, targetId) {
    const source = document.getElementById(sourceId);
    const target = document.getElementById(targetId);

    if (source && target) {
        source.addEventListener('input', function() {
            target.value = source.value;
            // Trigger calculation and validation if needed
            target.dispatchEvent(new Event('input'));
        });
    }
}

async function loadInventoryStock() {
    try {
        const response = await fetch('api/daily_reports.php?action=inventory_stock');
        const result = await response.json();
        
        if (result.success && result.data) {
            // Update unitCosts from inventory data
            result.data.forEach(item => {
                if (item.item_name && item.cost_per_unit) {
                    unitCosts[item.item_name] = parseFloat(item.cost_per_unit);
                }
            });
            updateInventoryDisplay(result.data);
            
            // Check if critical items are missing and show alert
            const requiredItems = ['Ice', 'Plastic', 'Tape', 'Ice Chest'];
            const missingItems = requiredItems.filter(itemName => 
                !result.data.find(item => item.item_name === itemName)
            );
            
            if (missingItems.length > 0) {
                showAlert(`Missing inventory items: ${missingItems.join(', ')}. Please add these items to inventory first.`, 'warning');
            }
        } else {
            console.error('Failed to load inventory stock');
            showAlert('Failed to load inventory stock. Please refresh the page.', 'danger');
        }
    } catch (error) {
        console.error('Error loading inventory stock:', error);
        showAlert('Error loading inventory stock. Please check your connection.', 'danger');
    }
}

function updateInventoryDisplay(inventoryData) {
    const inventoryMapping = {
        // 'Fish': 'fish',
        'Ice': 'ice',
        'Plastic': 'plastic',
        'Tape': 'tape',
        'Ice Chest': 'iceChest',
        // 'Box': 'boxes' Removed
    };
    
    // Initialize all fields with 0 availability first
    Object.values(inventoryMapping).forEach(fieldName => {
        const inputElement = document.getElementById(fieldName);
        if (inputElement) {
            inputElement.setAttribute('max', 0);
            inputElement.setAttribute('data-available', 0);
        }
    });
    
    inventoryData.forEach(item => {
        const fieldName = inventoryMapping[item.item_name];
        if (fieldName) {
            const inputElement = document.getElementById(fieldName);
            const labelElement = inputElement?.previousElementSibling;
            
            if (labelElement && labelElement.tagName === 'LABEL') {
                // Add stock info to label
                const stockInfo = labelElement.querySelector('.stock-info');
                if (stockInfo) {
                    stockInfo.remove();
                }
                
                const stockSpan = document.createElement('span');
                stockSpan.className = 'stock-info';
                stockSpan.style.cssText = 'color: #666; font-size: 0.9em; margin-left: 8px;';
                stockSpan.textContent = `(Available: ${item.current_stock} ${item.unit})`;
                labelElement.appendChild(stockSpan);
                
                // Set max attribute on input
                if (inputElement) {
                    inputElement.setAttribute('max', item.current_stock);
                    inputElement.setAttribute('data-available', item.current_stock);
                }
            }
        }
    });
    
    // Add warning for missing inventory items
    Object.keys(inventoryMapping).forEach(itemName => {
        const fieldName = inventoryMapping[itemName];
        const inputElement = document.getElementById(fieldName);
        if (inputElement && inputElement.getAttribute('data-available') === '0') {
            const found = inventoryData.find(item => item.item_name === itemName);
            if (!found) {
                // Item doesn't exist in inventory at all
                const labelElement = inputElement.previousElementSibling;
                if (labelElement && labelElement.tagName === 'LABEL') {
                    const stockSpan = document.createElement('span');
                    stockSpan.className = 'stock-info';
                    stockSpan.style.cssText = 'color: #e74c3c; font-size: 0.9em; margin-left: 8px;';
                    stockSpan.textContent = `(⚠️ Item not found in inventory)`;
                    labelElement.appendChild(stockSpan);
                }
            }
        }
    });
}

function addCalculationListeners() {
    const inputs = [
        'boxes', 'salles', 'cost', 'fish', 'iceChest', 
        'plastic', 'tape', 'ice', 'labor', 
        'freightMSR', 'freightBasZam', 'freightAirCargo', 'freightT2Market', 'airCargo'
    ];
    
    inputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', calculateTotals);
            element.addEventListener('change', calculateTotals);
            
            // Add validation for inventory items
            if (['ice', 'plastic', 'tape', 'iceChest'].includes(inputId)) {
                element.addEventListener('input', validateInventoryInput);
            }
        }

        const boxesInput = document.getElementById('boxes');
        if (boxesInput) {
            boxesInput.addEventListener('input', function() {
                calculateTotals();
            });
        }
    });
    
    // Form submission
    document.getElementById('dailyReportForm').addEventListener('submit', handleFormSubmit);
}

function validateInventoryInput(event) {
    const input = event.target;
    const available = parseInt(input.getAttribute('data-available')) || 0;
    const value = parseInt(input.value) || 0;
    
    // Remove existing warning
    const existingWarning = input.parentNode.querySelector('.inventory-warning');
    if (existingWarning) {
        existingWarning.remove();
    }
    
    if (value > available) {
        // Create warning message
        const warning = document.createElement('div');
        warning.className = 'inventory-warning';
        warning.style.cssText = 'color: #e74c3c; font-size: 0.8em; margin-top: 4px;';
        warning.textContent = `⚠️ Insufficient stock! Available: ${available}`;
        input.parentNode.appendChild(warning);
        
        // Highlight input
        input.style.borderColor = '#e74c3c';
    } else {
        // Reset input style
        input.style.borderColor = '';
    }
}

function calculateTotals() {
    // Get input values
    const boxes = parseFloat(document.getElementById('boxes').value) || 0;
     // AutoNumeric or fallback
    const sallesInput = AutoNumeric.getAutoNumericElement('#salles');
    const salles = sallesInput ? parseFloat(sallesInput.getNumber()) : (parseFloat(document.getElementById('salles').value) || 0);
    const fishInput = AutoNumeric.getAutoNumericElement('#fish');
    const fish = fishInput ? parseFloat(fishInput.getNumber()) : (parseFloat(document.getElementById('fish').value) || 0);
    const laborInput = AutoNumeric.getAutoNumericElement('#labor');
    const labor = laborInput ? parseFloat(laborInput.getNumber()) : (parseFloat(document.getElementById('labor').value) || 0);
    const airCargoNum = AutoNumeric.getAutoNumericElement('#airCargo');
    const airCargoInput = airCargoNum ? parseFloat(airCargoNum.getNumber()) : (parseFloat(document.getElementById('airCargo').value) || 0);

    // Inventory items
    const iceChest_qty = boxes; // iceChest_qty = boxes_qty
    // const plastic_qty = parseFloat(document.getElementById('plastic').value) || 0;
    const tape_qty = parseFloat(document.getElementById('tape').value) || 0;
    const ice_qty = parseFloat(document.getElementById('ice').value) || 0;
    // Unit costs with fallbacks
    const ICE_CHEST_COST = unitCosts['Ice Chest'] || 190.00;
    const PLASTIC_COST = unitCosts['Plastic'] || 12.00;
    const TAPE_COST = unitCosts['Tape'] || 42;
    const ICE_COST = unitCosts['Ice'] || 150.00;

    // Calculations
    const total_iceChest_cost = iceChest_qty * ICE_CHEST_COST;
    const total_plastic_qty = 3 * iceChest_qty;
    const total_plastic_cost = total_plastic_qty * PLASTIC_COST;
    const total_tape_cost = (tape_qty * iceChest_qty) * TAPE_COST;
    const total_ice_cost = ice_qty * ICE_COST;
    const laborCost = labor * iceChest_qty;
    // log calculations for debugging
    console.log({
        boxes, salles, fish, labor, airCargoInput,
        total_iceChest_cost, total_plastic_cost, total_tape_cost, total_ice_cost, fish, laborCost
    });

    // Final total cost
    const totalCost = total_iceChest_cost + total_plastic_cost + total_tape_cost + total_ice_cost + fish + laborCost;
    const salesPerBox = boxes > 0 ? salles / boxes : 0;
    const costPerBox = boxes > 0 ? totalCost / boxes : 0;
    const totalExpenses = totalCost; // Already includes freightAmount
    const netIncome = salles - totalExpenses;
    const profitMargin = salles > 0 ? (netIncome / salles) * 100 : 0;

    // Calculate 50/50 split for MSR and S3 sections
    calculateMSRAndS3Split(boxes, salesPerBox, costPerBox, airCargoInput);

    // Update calculated fields
    document.getElementById('plastic').value = total_plastic_qty;
    AutoNumeric.getAutoNumericElement('#totalCost').set(totalCost.toFixed(2));
    AutoNumeric.getAutoNumericElement('#salesPerBox').set(salesPerBox.toFixed(2));
    AutoNumeric.getAutoNumericElement('#costPerBox').set(costPerBox.toFixed(2));

    // Update Freight Fields
    AutoNumeric.getAutoNumericElement('#freightMSR').set(window.msrS3Split.msr.freightMSR || 0);
    AutoNumeric.getAutoNumericElement('#freightAirCargo').set(window.msrS3Split.s3.freightAirCargo || 0);
    AutoNumeric.getAutoNumericElement('#freightBasZam').set(window.msrS3Split.s3.freightBasZam || 0);
    AutoNumeric.getAutoNumericElement('#freightT2Market').set(window.msrS3Split.s3.freightT2Market || 0);

    // Update summary
    document.getElementById('summaryNetIncome').textContent = formatCurrency(netIncome);
    document.getElementById('summaryTotalExpenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('summaryProfitMargin').textContent = profitMargin.toFixed(2) + '%';

    // Update summary colors based on profit/loss
    const netIncomeElement = document.getElementById('summaryNetIncome');
    const profitMarginElement = document.getElementById('summaryProfitMargin');

    if (netIncome >= 0) {
        netIncomeElement.style.color = 'var(--success-color)';
        profitMarginElement.style.color = 'var(--success-color)';
    } else {
        netIncomeElement.style.color = 'var(--danger-color)';
        profitMarginElement.style.color = 'var(--danger-color)';
    }
}

function calculateMSRAndS3Split(totalBoxes, salesPerBox, costPerBox, airCargoInput ) {
    // Calculate 50/50 split for boxes
    // For even numbers: split equally
    // For odd numbers: MSR gets the extra box
    const s3Boxes = Math.floor(totalBoxes / 2);
    const msrBoxes = totalBoxes - s3Boxes;
    
    // Calculate proportional split for sales and costs
    if (totalBoxes > 0) {
        //S3 Expenses
        const s3Cost = s3Boxes * costPerBox;
        const freightBasZam = 350 * s3Boxes;
        const freightAirCargo = airCargoInput / totalBoxes * s3Boxes;
        const freightT2Market = 140 * s3Boxes;
        const s3Expenses = s3Cost + freightBasZam + freightT2Market + freightAirCargo;

        //S3 INCOME
        const s3Sales = s3Boxes * salesPerBox;
        const s3NetIncome = s3Sales - s3Expenses;

                //MSR Expenses
        const msrCost = msrBoxes * costPerBox;
        const msrFreight = 1800 * msrBoxes;
        const msrExpenses = msrCost + msrFreight + airCargo;

        //MSR INCOME
        const msrSales = msrBoxes * salesPerBox;
        const msrNetIncome = msrSales - msrExpenses;

        // Store the calculated values in window object for access by other modules
        window.msrS3Split = {
            s3: {
                boxes: s3Boxes,
                sales: s3Sales,
                cost: s3Cost,
                freightBasZam: freightBasZam,
                freightAirCargo: freightAirCargo,
                freightT2Market: freightT2Market,
                expenses: s3Expenses,
                netIncome: s3NetIncome,
            },
            msr: {
                boxes: msrBoxes,
                sales: msrSales,
                cost: msrCost,
                freightMSR: msrFreight,
                expenses: msrExpenses,
                netIncome: msrNetIncome,
            }
        };
    } else {
        // Reset values when no boxes
        window.msrS3Split = {
            s3: { boxes: 0, sales: 0, cost: 0, expenses: 0, freightBasZam: 0, freightAirCargo: 0, freightT2Market: 0 },
            msr: { boxes: 0, sales: 0, cost: 0, expenses: 0, freightMSR: 0 }
        };
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Validate inventory availability before submitting
    const inventoryFields = ['ice', 'plastic', 'tape', 'iceChest'];
    let hasInventoryError = false;
    
    inventoryFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);
        if (input) {
            const available = parseInt(input.getAttribute('data-available')) || 0;
            const value = parseInt(input.value) || 0;
            
            if (value > available) {
                hasInventoryError = true;
                showAlert(`Insufficient ${fieldId} stock! Available: ${available}, Required: ${value}`, 'danger');
            }
        }
    });
    
    if (hasInventoryError) {
        return;
    }
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Convert numeric fields
    const numericFields = [
        'boxes', 'salles', 'cost', 'fish', 'ice_chest', 'plastic', 
        'tape', 'ice', 'labor', 'total_cost', 'sales_per_box', 
        'cost_per_box', 'freight_msr', 'freight_bas_zam', 'freight_air_cargo', 
        'freight_t2_market', 'airCargo'
    ];
    
    numericFields.forEach(field => {
        data[field] = parseFloat(data[field]) || 0;
    });
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    try {
        submitBtn.innerHTML = '<div class="spinner"></div> Saving...';
        submitBtn.disabled = true;
        
        const response = await fetch('api/daily_reports.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Report saved successfully!', 'success');
            resetForm();
            
            // Send WebSocket notification
            if (window.wsManager) {
                wsManager.sendNewReport({
                    date: data.report_date,
                    boxes: data.boxes,
                    sales: data.salles
                });
            }
        } else {
            showAlert(result.message || 'Failed to save report', 'danger');
        }
    } catch (error) {
        console.error('Error saving report:', error);
        showAlert('Error saving report. Please try again.', 'danger');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function resetForm() {
    document.getElementById('dailyReportForm').reset();
    document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
    
    // Clear any inventory warnings
    const warnings = document.querySelectorAll('.inventory-warning');
    warnings.forEach(warning => warning.remove());
    
    // Reset input border colors
    const inputs = document.querySelectorAll('input[data-available]');
    inputs.forEach(input => {
        input.style.borderColor = '';
    });
    
    calculateTotals();
    
    // Reload inventory stock to get fresh data
    loadInventoryStock();
}

async function showReportHistory() {
    const historySection = document.getElementById('reportsHistory');
    historySection.style.display = 'block';
    
    // Scroll to history section
    historySection.scrollIntoView({ behavior: 'smooth' });
    
    await loadReportsHistory();
}

function hideReportHistory() {
    document.getElementById('reportsHistory').style.display = 'none';
}

async function loadReportsHistory(filters = {}) {
    try {
        let url = 'api/daily_reports.php';
        const params = new URLSearchParams();
        
        if (filters.date_from) params.append('date_from', filters.date_from);
        if (filters.date_to) params.append('date_to', filters.date_to);
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        const result = await response.json();
        
        const tbody = document.getElementById('reportsTableBody');
        
        if (result.success && result.data && result.data.length > 0) {
            tbody.innerHTML = result.data.map(report => {
                const netIncome = (report.salles || 0) - (
                    (report.total_cost || 0) +
                    (report.freight_msr || 0) +
                    (report.freight_bas_zam || 0) +
                    (report.freight_air_cargo || 0) +
                    (report.freight_t2_market || 0)
                );
                
                return `
                    <tr>
                        <td>${formatDate(report.report_date)}</td>
                        <td>${report.boxes || 0}</td>
                        <td>${formatCurrency(report.salles || 0)}</td>
                        <td>${formatCurrency(report.total_cost || 0)}</td>
                        <td class="${netIncome >= 0 ? 'text-success' : 'text-danger'}">
                            ${formatCurrency(netIncome)}
                        </td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="editReport(${report.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteReport(${report.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No reports found</td></tr>';
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        document.getElementById('reportsTableBody').innerHTML = 
            '<tr><td colspan="6" class="text-center text-danger">Error loading reports</td></tr>';
    }
}

function filterReports() {
    const dateFrom = document.getElementById('filterDateFrom').value;
    const dateTo = document.getElementById('filterDateTo').value;
    
    const filters = {};
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    
    loadReportsHistory(filters);
}

async function editReport(reportId) {
    try {
        const response = await fetch(`api/daily_reports.php?id=${reportId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            currentEditingReport = result.data;
            populateEditForm(result.data);
            document.getElementById('editReportModal').classList.add('show');
        } else {
            showAlert('Failed to load report data', 'danger');
        }
    } catch (error) {
        console.error('Error loading report:', error);
        showAlert('Error loading report data', 'danger');
    }
}

function populateEditForm(report) {
    document.getElementById('editReportId').value = report.id;
    document.getElementById('editReportDate').value = report.report_date;
    document.getElementById('editBoxes').value = report.boxes;
    
    // Add all other fields if they exist in the edit form
    const fieldMappings = {
        'editSalles': 'salles',
        'editCost': 'cost',
        'editFish': 'fish',
        'editIceChest': 'ice_chest',
        'editPlastic': 'plastic',
        'editTape': 'tape',
        'editIce': 'ice',
        'editLabor': 'labor',
        'editFreightMSR': 'freight_msr',
        'editFreightBasZam': 'freight_bas_zam',
        'editFreightAirCargo': 'freight_air_cargo',
        'editFreightT2Market': 'freight_t2_market'
    };
    
    Object.keys(fieldMappings).forEach(editFieldId => {
        const element = document.getElementById(editFieldId);
        if (element && report[fieldMappings[editFieldId]] !== undefined) {
            element.value = report[fieldMappings[editFieldId]];
        }
    });
}

function closeEditModal() {
    document.getElementById('editReportModal').classList.remove('show');
    currentEditingReport = null;
}

async function saveEditedReport() {
    const reportId = document.getElementById('editReportId').value;
    
    // Collect all form data
    const formData = {
        id: reportId,
        report_date: document.getElementById('editReportDate').value,
        boxes: parseFloat(document.getElementById('editBoxes').value) || 0
    };
    
    // Add other fields if they exist
    const fieldMappings = {
        'editSalles': 'salles',
        'editCost': 'cost',
        'editFish': 'fish',
        'editIceChest': 'ice_chest',
        'editPlastic': 'plastic',
        'editTape': 'tape',
        'editIce': 'ice',
        'editLabor': 'labor',
        'editFreightMSR': 'freight_msr',
        'editFreightBasZam': 'freight_bas_zam',
        'editFreightAirCargo': 'freight_air_cargo',
        'editFreightT2Market': 'freight_t2_market'
    };
    
    Object.keys(fieldMappings).forEach(editFieldId => {
        const element = document.getElementById(editFieldId);
        if (element) {
            const value = element.type === 'number' ? parseFloat(element.value) || 0 : element.value;
            formData[fieldMappings[editFieldId]] = value;
        }
    });
    
    // Calculate totals for edited data
    const totalCost = (formData.cost || 0) + (formData.fish || 0) + (formData.ice_chest || 0) + 
                     (formData.plastic || 0) + (formData.tape || 0) + (formData.ice || 0) + (formData.labor || 0);
    const salesPerBox = formData.boxes > 0 ? (formData.salles || 0) / formData.boxes : 0;
    const costPerBox = formData.boxes > 0 ? totalCost / formData.boxes : 0;
    
    formData.total_cost = totalCost;
    formData.sales_per_box = salesPerBox;
    formData.cost_per_box = costPerBox;
    
    try {
        const response = await fetch('api/daily_reports.php', {
            method: 'PUT',
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
            showAlert('Report updated successfully!', 'success');
            closeEditModal();
            await loadReportsHistory();
        } else {
            showAlert(result.message || 'Failed to update report', 'danger');
        }
    } catch (error) {
        console.error('Error updating report:', error);
        showAlert('Network error occurred. Please check your connection and try again.', 'danger');
    }
}

async function deleteReport(reportId) {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`api/daily_reports.php?id=${reportId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Report deleted successfully!', 'success');
            loadReportsHistory();
        } else {
            showAlert(result.message || 'Failed to delete report', 'danger');
        }
    } catch (error) {
        console.error('Error deleting report:', error);
        showAlert('Error deleting report', 'danger');
    }
}

function showAlert(message, type = 'info') {
    const alertDiv = document.getElementById('reportAlert');
    if (alertDiv) {
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
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
