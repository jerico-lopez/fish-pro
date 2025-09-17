// S3 Section JavaScript
let s3Reports = [];
let s3RevenueChart = null;
let s3FreightChart = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('s3').then(hasPermission => {
                if (hasPermission) {
                    initializeS3();
                }
            });
        }
    }, 500);
});

function initializeS3() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('s3FilterFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('s3FilterToDate').value = today.toISOString().split('T')[0];
    
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('s3.html');
    
    // Load initial data
    loadS3Data();
}

async function loadS3Data(filters = {}) {
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
            s3Reports = result.data;
            updateS3Metrics();
            updateS3Table();
            updateS3Charts();
            updateS3Summary();
        } else {
            showS3Error('Failed to load S3 data');
        }
    } catch (error) {
        console.error('Error loading S3 data:', error);
        showS3Error('Error loading S3 data');
    }
}

function updateS3Metrics() {
    const totals = s3Reports.reduce((acc, report) => {
        const totalBoxes = parseInt(report.boxes) || 0;
        const totalSales = parseFloat(report.salles) || 0;
        const totalCost = parseFloat(report.total_cost) || 0;
        const cost = parseFloat(report.cost) || 0;
        const fish = parseFloat(report.fish) || 0;
        const iceChest = parseFloat(report.ice_chest) || 0;
        const plastic = parseFloat(report.plastic) || 0;
        const tape = parseFloat(report.tape) || 0;
        const ice = parseFloat(report.ice) || 0;
        const labor = parseFloat(report.labor) || 0;
        const freightType = report.freight_type || '';
        const freightAmount = parseFloat(report.freight_amount) || 0;
        
        // Calculate S3 split (50% of boxes, rounded down)
        const s3Boxes = Math.floor(totalBoxes / 2);
        const s3Ratio = totalBoxes > 0 ? s3Boxes / totalBoxes : 0;
        
        // Debug logging
        console.log(`S3 Debug - Total Boxes: ${totalBoxes}, S3 Boxes: ${s3Boxes}, S3 Ratio: ${s3Ratio}, Freight Type: ${freightType}`);
        
        // Split ALL costs and expenses proportionally for S3
        const s3Sales = totalSales * s3Ratio;
        const s3Cost = cost * s3Ratio;
        const s3Fish = fish * s3Ratio;
        const s3IceChest = iceChest * s3Ratio;
        const s3Plastic = plastic * s3Ratio;
        const s3Tape = tape * s3Ratio;
        const s3Ice = ice * s3Ratio;
        const s3Labor = labor * s3Ratio;
        const s3TotalCost = totalCost * s3Ratio;
        const s3FreightAmount = freightAmount * s3Ratio;
        
        // Calculate freight costs for S3 portion based on selected freight type
        let freightCargo = 0;
        let freightAir = 0;
        
        if (freightType === 'cargo') {
            freightCargo = s3FreightAmount;
        } else if (freightType === 'air') {
            freightAir = s3FreightAmount;
        }
        
        // Total S3 expenses = all operational costs + selected freight type amount
        const s3TotalExpenses = s3TotalCost + s3FreightAmount;
        
        acc.boxes += s3Boxes;
        
        // Debug final accumulation
        console.log(`S3 Accumulation - Adding ${s3Boxes} boxes, Total so far: ${acc.boxes + s3Boxes}`);
        acc.sales += s3Sales;
        acc.expenses += s3TotalExpenses;
        acc.cost += s3Cost;
        acc.freightCargo = (acc.freightCargo || 0) + freightCargo;
        acc.freightAir = (acc.freightAir || 0) + freightAir;
        acc.netIncome += s3Sales - s3TotalExpenses;
        
        return acc;
    }, { 
        boxes: 0, sales: 0, expenses: 0, cost: 0, 
        freightCargo: 0, freightAir: 0, netIncome: 0 
    });
    
    document.getElementById('s3TotalBoxes').textContent = totals.boxes;
    document.getElementById('s3TotalSales').textContent = formatCurrency(totals.sales);
    document.getElementById('s3TotalExpenses').textContent = formatCurrency(totals.expenses);
    document.getElementById('s3TotalCost').textContent = formatCurrency(totals.cost);
    document.getElementById('s3FreightBazam').textContent = formatCurrency(totals.freightCargo);
    document.getElementById('s3AirCargo').textContent = formatCurrency(totals.freightAir);
    document.getElementById('s3FreightT2Market').textContent = formatCurrency(0); // Not used anymore
    
    const netIncomeElement = document.getElementById('s3NetIncome');
    netIncomeElement.textContent = formatCurrency(totals.netIncome);
    netIncomeElement.style.color = totals.netIncome >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

function updateS3Table() {
    const tbody = document.getElementById('s3TableBody');
    
    if (s3Reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">No S3 data found</td></tr>';
        return;
    }
    
    tbody.innerHTML = s3Reports.map(report => {
        const totalBoxes = parseInt(report.boxes) || 0;
        const totalSales = parseFloat(report.salles) || 0;
        const totalCost = parseFloat(report.total_cost) || 0;
        const cost = parseFloat(report.cost) || 0;
        const fish = parseFloat(report.fish) || 0;
        const iceChest = parseFloat(report.ice_chest) || 0;
        const plastic = parseFloat(report.plastic) || 0;
        const tape = parseFloat(report.tape) || 0;
        const ice = parseFloat(report.ice) || 0;
        const labor = parseFloat(report.labor) || 0;
        const airCargo = parseFloat(report.air_cargo) || 0;
        
        // Calculate S3 split (50% of boxes, rounded down)
        const s3Boxes = Math.floor(totalBoxes / 2);
        const s3Ratio = totalBoxes > 0 ? s3Boxes / totalBoxes : 0;
        
        // Split ALL values proportionally for S3
        const s3Sales = totalSales * s3Ratio;
        const s3Cost = cost * s3Ratio;
        const s3TotalCost = totalCost * s3Ratio;
        const s3AirCargo = airCargo * s3Ratio;
        
        // Calculate freight costs for S3 portion
        const freightCargo = s3TotalCost * 0.08;
        const freightAir = (parseFloat(report.air_cargo) || 0) * s3Ratio;
        const totalExpenses = s3TotalCost + freightCargo + freightAir;
        const netIncome = s3Sales - totalExpenses;
        const profitMargin = s3Sales > 0 ? (netIncome / s3Sales) * 100 : 0;
        
        return `
            <tr>
                <td>${formatDate(report.report_date)}</td>
                <td>${s3Boxes}</td>
                <td>${formatCurrency(s3Sales)}</td>
                <td>${formatCurrency(totalExpenses)}</td>
                <td>${formatCurrency(s3Cost)}</td>
                <td>${formatCurrency(freightCargo)}</td>
                <td>${formatCurrency(freightAir)}</td>
                <td>${formatCurrency(0)}</td>
                <td class="${netIncome >= 0 ? 'text-success' : 'text-danger'}">
                    ${formatCurrency(netIncome)}
                </td>
                <td class="${profitMargin >= 0 ? 'text-success' : 'text-danger'}">
                    ${profitMargin.toFixed(2)}%
                </td>
            </tr>
        `;
    }).join('');
}

function updateS3Charts() {
    updateS3RevenueChart();
    updateS3FreightChart();
}

function updateS3RevenueChart() {
    const ctx = document.getElementById('s3RevenueChart').getContext('2d');
    
    if (s3RevenueChart) {
        s3RevenueChart.destroy();
    }
    
    const labels = s3Reports.map(report => formatDate(report.report_date));
    const revenueData = s3Reports.map(report => parseFloat(report.salles) || 0);
    const costData = s3Reports.map(report => {
        const totalCost = parseFloat(report.total_cost) || 0;
        const airCargo = parseFloat(report.air_cargo) || 0;
        const freightBazam = totalCost * 0.1;
        const freightT2Market = totalCost * 0.05;
        return totalCost + airCargo + freightBazam + freightT2Market;
    });
    
    s3RevenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#27ae60',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4
                },
                {
                    label: 'Total Costs',
                    data: costData,
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#e74c3c',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#2c3e50',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3498db',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#2c3e50',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return '₱' + value.toLocaleString();
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#2c3e50',
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

function updateS3FreightChart() {
    const ctx = document.getElementById('s3FreightChart').getContext('2d');
    
    if (s3FreightChart) {
        s3FreightChart.destroy();
    }
    
    const freightTotals = s3Reports.reduce((acc, report) => {
        const totalCost = parseFloat(report.total_cost) || 0;
        const freightType = report.freight_type || '';
        const freightAmount = parseFloat(report.freight_amount) || 0;
        
        // Calculate S3 split (50% of boxes, rounded down)
        const totalBoxes = parseInt(report.boxes) || 0;
        const s3Boxes = Math.floor(totalBoxes / 2);
        const s3Ratio = totalBoxes > 0 ? s3Boxes / totalBoxes : 0;
        const s3FreightAmount = freightAmount * s3Ratio;
        
        if (freightType === 'cargo') {
            acc.freightCargo += s3FreightAmount;
        } else if (freightType === 'air') {
            acc.freightAir += s3FreightAmount;
        }
        
        return acc;
    }, { freightCargo: 0, freightAir: 0 });
    
    s3FreightChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Freight Cargo', 'Freight Air'],
            datasets: [{
                data: [
                    freightTotals.freightCargo,
                    freightTotals.freightAir
                ],
                backgroundColor: [
                    '#3498db', // Bright blue for cargo
                    '#e74c3c'  // Bright red for air
                ],
                borderColor: [
                    '#2980b9', // Darker blue border
                    '#c0392b'  // Darker red border
                ],
                borderWidth: 3,
                hoverBackgroundColor: [
                    '#5dade2', // Lighter blue on hover
                    '#ec7063'  // Lighter red on hover
                ],
                hoverBorderWidth: 4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#2c3e50',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3498db',
                    borderWidth: 1
                }
            },
            cutout: '60%',
            maintainAspectRatio: false
        }
    });
}

function updateS3Summary() {
    if (s3Reports.length === 0) {
        document.getElementById('s3AvgProfitMargin').textContent = '0%';
        document.getElementById('s3AvgSalesPerBox').textContent = formatCurrency(0);
        document.getElementById('s3AvgCostPerBox').textContent = formatCurrency(0);
        document.getElementById('s3AvgFreightCost').textContent = formatCurrency(0);
        return;
    }
    
    const totals = s3Reports.reduce((acc, report) => {
        const sales = parseFloat(report.salles) || 0;
        const totalCost = parseFloat(report.total_cost) || 0;
        const airCargo = parseFloat(report.air_cargo) || 0;
        const freightBazam = totalCost * 0.1;
        const freightT2Market = totalCost * 0.05;
        const totalExpenses = totalCost + airCargo + freightBazam + freightT2Market;
        const netIncome = sales - totalExpenses;
        const profitMargin = sales > 0 ? (netIncome / sales) * 100 : 0;
        
        acc.profitMargin += profitMargin;
        acc.salesPerBox += parseFloat(report.sales_per_box) || 0;
        acc.costPerBox += parseFloat(report.cost_per_box) || 0;
        acc.freightCost += freightBazam + freightT2Market + airCargo;
        
        return acc;
    }, { profitMargin: 0, salesPerBox: 0, costPerBox: 0, freightCost: 0 });
    
    const avgProfitMargin = totals.profitMargin / s3Reports.length;
    const avgSalesPerBox = totals.salesPerBox / s3Reports.length;
    const avgCostPerBox = totals.costPerBox / s3Reports.length;
    const avgFreightCost = totals.freightCost / s3Reports.length;
    
    const profitMarginElement = document.getElementById('s3AvgProfitMargin');
    profitMarginElement.textContent = avgProfitMargin.toFixed(2) + '%';
    profitMarginElement.style.color = avgProfitMargin >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    
    document.getElementById('s3AvgSalesPerBox').textContent = formatCurrency(avgSalesPerBox);
    document.getElementById('s3AvgCostPerBox').textContent = formatCurrency(avgCostPerBox);
    document.getElementById('s3AvgFreightCost').textContent = formatCurrency(avgFreightCost);
}

function applyS3Filters() {
    const fromDate = document.getElementById('s3FilterFromDate').value;
    const toDate = document.getElementById('s3FilterToDate').value;
    
    const filters = {};
    if (fromDate) filters.date_from = fromDate;
    if (toDate) filters.date_to = toDate;
    
    loadS3Data(filters);
}

function clearS3Filters() {
    document.getElementById('s3FilterFromDate').value = '';
    document.getElementById('s3FilterToDate').value = '';
    loadS3Data();
}

function exportS3Data() {
    if (s3Reports.length === 0) {
        alert('No S3 data to export');
        return;
    }
    
    // Create CSV content
    const headers = [
        'Date', 'Boxes', 'Sales', 'Expenses', 'Cost', 'Freight Bas-Zam', 
        'Air Cargo', 'Freight T2-Market', 'Net Income', 'Profit Margin'
    ];
    
    const csvContent = [
        headers.join(','),
        ...s3Reports.map(report => {
            const sales = parseFloat(report.salles) || 0;
            const totalCost = parseFloat(report.total_cost) || 0;
            const airCargo = parseFloat(report.air_cargo) || 0;
            const cost = parseFloat(report.cost) || 0;
            const freightBazam = totalCost * 0.1;
            const freightT2Market = totalCost * 0.05;
            const totalExpenses = totalCost + airCargo + freightBazam + freightT2Market;
            const netIncome = sales - totalExpenses;
            const profitMargin = sales > 0 ? (netIncome / sales) * 100 : 0;
            
            return [
                report.report_date,
                report.boxes || 0,
                sales,
                totalExpenses,
                cost,
                freightBazam,
                airCargo,
                freightT2Market,
                netIncome,
                profitMargin.toFixed(2)
            ].join(',');
        })
    ].join('\n');
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fish-pro-s3-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showS3Error(message) {
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
