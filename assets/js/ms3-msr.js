// MS3 & MSR JavaScript
let currentReports = [];
let salesExpensesChart = null;
let profitMarginChart = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('ms3_msr').then(hasPermission => {
                if (hasPermission) {
                    initializeMS3MSR();
                }
            });
        }
    }, 500);
});

function initializeMS3MSR() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('filterFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('filterToDate').value = today.toISOString().split('T')[0];
    
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('ms3-msr.html');
    
    // Load initial data
    loadReportsData();
}

async function loadReportsData(filters = {}) {
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
        
        if (result.success && result.data) {
            currentReports = result.data;
            updateSummaryStats();
            updateReportsTable();
            updateCostBreakdown();
            updateCharts();
        } else {
            showError('Failed to load reports data');
        }
    } catch (error) {
        console.error('Error loading reports:', error);
        showError('Error loading reports data');
    }
}

function updateSummaryStats() {
    const totals = currentReports.reduce((acc, report) => {
        acc.boxes += parseInt(report.boxes) || 0;
        acc.sales += parseFloat(report.salles) || 0;
        acc.totalCost += parseFloat(report.total_cost) || 0;
        acc.msr_freight += parseFloat(report.msr.freight) || 0;
        acc.air_cargo += parseFloat(report.s3.freight.air_cargo) || 0;
        acc.bas_zam += report.s3.freight.bas_zam || 0;
        acc.t2_market += report.s3.freight.t2_market || 0;
        return acc;
    }, { boxes: 0, sales: 0, totalCost: 0, msr_freight: 0, air_cargo: 0, bas_zam: 0, t2_market: 0 });

    const totalExpenses = totals.totalCost + totals.air_cargo + totals.bas_zam + totals.t2_market + totals.msr_freight || 0;
    const netIncome = totals.sales - totalExpenses || 0;
    
    document.getElementById('totalBoxesMS3').textContent = totals.boxes;
    document.getElementById('totalSalesMS3').textContent = formatCurrency(totals.sales);
    document.getElementById('totalExpensesMS3').textContent = formatCurrency(totalExpenses);
    
    const netIncomeElement = document.getElementById('netIncomeMS3');
    netIncomeElement.textContent = formatCurrency(netIncome);
    netIncomeElement.style.color = netIncome >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

function updateReportsTable() {
    const tbody = document.getElementById('reportsTableBody');
    
    if (currentReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="15" class="text-center text-muted">No reports found</td></tr>';
        return;
    }
    
    tbody.innerHTML = currentReports.map(report => {
        const totalExpenses = (parseFloat(report.total_cost) || 0) + (parseFloat(report.s3.freight.bas_zam) || 0) + (parseFloat(report.s3.freight.t2_market) || 0) + (parseFloat(report.s3.freight.air_cargo) || 0) + (parseFloat(report.msr.freight) || 0);
        const netIncome = (parseFloat(report.salles) || 0) - totalExpenses;
        
        return `
            <tr>
                <td>${formatDate(report.report_date)}</td>
                <td>${report.boxes || 0}</td>
                <td>${formatCurrency(report.salles || 0)}</td>
                <td>${formatCurrency(report.total_cost || 0)}</td>
                <td>${formatCurrency(report.fish || 0)}</td>
                <td>${formatCurrency(report.ice_chest || 0)}</td>
                <td>${formatCurrency(report.plastic || 0)}</td>
                <td>${formatCurrency(report.tape || 0)}</td>
                <td>${formatCurrency(report.ice || 0)}</td>
                <td>${formatCurrency(report.labor || 0)}</td>
                <td>${formatCurrency(report.total_cost || 0)}</td>
                <td>${formatCurrency(report.sales_per_box || 0)}</td>
                <td>${formatCurrency(report.cost_per_box || 0)}</td>
                <td>${formatCurrency(report.air_cargo || 0)}</td>
                <td class="${netIncome >= 0 ? 'text-success' : 'text-danger'}">
                    ${formatCurrency(netIncome)}
                </td>
            </tr>
        `;
    }).join('');
}

function updateCostBreakdown() {
    const breakdown = currentReports.reduce((acc, report) => {
        acc.fish += parseFloat(report.fish) || 0;
        acc.iceChest += parseFloat(report.ice_chest) || 0;
        acc.plastic += parseFloat(report.plastic) || 0;
        acc.tape += parseFloat(report.tape) || 0;
        acc.ice += parseFloat(report.ice) || 0;
        acc.labor += parseFloat(report.labor) || 0;
        acc.airCargo += parseFloat(report.air_cargo) || 0;  
        return acc;
    }, { fish: 0, iceChest: 0, plastic: 0, tape: 0, ice: 0, labor: 0, airCargo: 0 });
    
    document.getElementById('totalFishCost').textContent = formatCurrency(breakdown.fish);
    document.getElementById('totalIceChestCost').textContent = formatCurrency(breakdown.iceChest);
    document.getElementById('totalPlasticCost').textContent = formatCurrency(breakdown.plastic);
    document.getElementById('totalTapeCost').textContent = formatCurrency(breakdown.tape);
    document.getElementById('totalIceCost').textContent = formatCurrency(breakdown.ice);
    document.getElementById('totalLaborCost').textContent = formatCurrency(breakdown.labor);
    document.getElementById('totalAirCargoCost').textContent = formatCurrency(breakdown.airCargo);
}


function updateCharts() {
    updateSalesExpensesChart();
    updateProfitMarginChart();
}

function updateSalesExpensesChart() {
    const ctx = document.getElementById('salesExpensesChart').getContext('2d');
    
    if (salesExpensesChart) {
        salesExpensesChart.destroy();
    }
    
    const labels = currentReports.map(report => formatDate(report.report_date));
    const salesData = currentReports.map(report => parseFloat(report.salles) || 0);
    const expensesData = currentReports.map(report => 
        (parseFloat(report.total_cost) || 0) + (parseFloat(report.s3.freight.air_cargo) || 0) + (parseFloat(report.s3.freight.bas_zam) || 0) + (parseFloat(report.s3.freight.t2_market) || 0) + (parseFloat(report.msr.freight) || 0)
    );
    
    salesExpensesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Sales',
                    data: salesData,
                    borderColor: 'var(--success-color)',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Expenses',
                    data: expensesData,
                    borderColor: 'var(--danger-color)',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₱' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function updateProfitMarginChart() {
    const ctx = document.getElementById('profitMarginChart').getContext('2d');
    
    if (profitMarginChart) {
        profitMarginChart.destroy();
    }
    
    const labels = currentReports.map(report => formatDate(report.report_date));
    const profitMarginData = currentReports.map(report => {
        const sales = parseFloat(report.salles) || 0;
        const expenses = (parseFloat(report.total_cost) || 0) + (parseFloat(report.s3.freight.air_cargo) || 0) + (parseFloat(report.s3.freight.bas_zam) || 0) + (parseFloat(report.s3.freight.t2_market) || 0) + (parseFloat(report.msr.freight) || 0);
        const netIncome = sales - expenses;
        return sales > 0 ? (netIncome / sales) * 100 : 0;
    });
    
    profitMarginChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit Margin (%)',
                data: profitMarginData,
                backgroundColor: profitMarginData.map(value => 
                    value >= 0 ? 'rgba(39, 174, 96, 0.7)' : 'rgba(231, 76, 60, 0.7)'
                ),
                borderColor: profitMarginData.map(value => 
                    value >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                ),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

function applyFilters() {
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    
    const filters = {};
    if (fromDate) filters.date_from = fromDate;
    if (toDate) filters.date_to = toDate;
    
    loadReportsData(filters);
}

function clearFilters() {
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    loadReportsData();
}

function toggleView(viewType) {
    // Implementation for different view types
    if (viewType === 'summary') {
        // Show summary view
        console.log('Switching to summary view');
    } else if (viewType === 'detailed') {
        // Show detailed view
        console.log('Switching to detailed view');
    }
}

function exportData() {
    if (currentReports.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV content
    const headers = [
        'Date', 'Boxes', 'Sales', 'Cost', 'Fish', 'Ice Chest', 'Plastic', 
        'Tape', 'Ice', 'Labor', 'Total Cost', 'Sales per Box', 'Cost per Box', 
        'Air Cargo', 'Net Income'
    ];
    
    const csvContent = [
        headers.join(','),
        ...currentReports.map(report => {
            const totalExpenses = (parseFloat(report.total_cost) || 0) + (parseFloat(report.air_cargo) || 0);
            const netIncome = (parseFloat(report.salles) || 0) - totalExpenses;
            
            return [
                report.report_date,
                report.boxes || 0,
                report.salles || 0,
                report.cost || 0,
                report.fish || 0,
                report.ice_chest || 0,
                report.plastic || 0,
                report.tape || 0,
                report.ice || 0,
                report.labor || 0,
                report.total_cost || 0,
                report.sales_per_box || 0,
                report.cost_per_box || 0,
                report.air_cargo || 0,
                netIncome
            ].join(',');
        })
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-pro-ms3-msr-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showError(message) {
    console.error(message);
    // You could implement a toast notification here
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
        month: 'short',
        day: 'numeric'
    });
}
