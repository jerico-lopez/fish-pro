// MSR Section JavaScript
let msrReports = [];
let msrRevenueChart = null;
let msrCostChart = null;

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    requireAuth();
    setTimeout(() => {
        if (window.currentUser) {
            requirePermission('msr').then(hasPermission => {
                if (hasPermission) {
                    initializeMSR();
                }
            });
        }
    }, 500);
});

function initializeMSR() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    document.getElementById('msrFilterFromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('msrFilterToDate').value = today.toISOString().split('T')[0];
    
    // Load theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Set active navigation
    setActiveNav('msr.html');
    
    // Load initial data
    loadMSRData();
}

async function loadMSRData(filters = {}) {
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
            msrReports = result.data;
            updateMSRMetrics();
            updateMSRTable();
            updateMSRCharts();
            updateMSRSummary();
        } else {
            showMSRError('Failed to load MSR data');
        }
    } catch (error) {
        console.error('Error loading MSR data:', error);
        showMSRError('Error loading MSR data');
    }
}

function updateMSRMetrics() {
    const totals = msrReports.reduce((acc, report) => {
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
        
        // Calculate MSR split (50% + remainder if odd)
        const s3Boxes = Math.floor(totalBoxes / 2);
        const msrBoxes = totalBoxes - s3Boxes;
        const msrRatio = totalBoxes > 0 ? msrBoxes / totalBoxes : 0;
        
        // Debug logging
        console.log(`MSR Debug - Total Boxes: ${totalBoxes}, MSR Boxes: ${msrBoxes}, MSR Ratio: ${msrRatio}, Freight Type: ${freightType}`);
        
        // Split ALL costs and expenses proportionally for MSR
        const msrSales = totalSales * msrRatio;
        const msrCost = cost * msrRatio;
        const msrFish = fish * msrRatio;
        const msrIceChest = iceChest * msrRatio;
        const msrPlastic = plastic * msrRatio;
        const msrTape = tape * msrRatio;
        const msrIce = ice * msrRatio;
        const msrLabor = labor * msrRatio;
        const msrTotalCost = totalCost * msrRatio;
        const msrFreightAmount = freightAmount * msrRatio;
        
        // Calculate freight based on selected freight type
        let freightCargo = 0;
        let freightAir = 0;
        
        if (freightType === 'cargo') {
            freightCargo = msrFreightAmount;
        } else if (freightType === 'air') {
            freightAir = msrFreightAmount;
        }
        
        // Total MSR expenses = all operational costs + selected freight type amount
        const totalExpenses = msrTotalCost + msrFreightAmount;
        
        acc.boxes += msrBoxes;
        
        // Debug final accumulation
        console.log(`MSR Accumulation - Adding ${msrBoxes} boxes, Total so far: ${acc.boxes + msrBoxes}`);
        acc.sales += msrSales;
        acc.expenses += totalExpenses;
        acc.cost += msrCost;
        acc.freight += freightCargo + freightAir;
        acc.netIncome += msrSales - totalExpenses;
        
        return acc;
    }, { boxes: 0, sales: 0, expenses: 0, cost: 0, freight: 0, netIncome: 0 });
    
    document.getElementById('msrTotalBoxes').textContent = totals.boxes;
    document.getElementById('msrTotalSales').textContent = formatCurrency(totals.sales);
    document.getElementById('msrTotalExpenses').textContent = formatCurrency(totals.expenses);
    document.getElementById('msrTotalCost').textContent = formatCurrency(totals.cost);
    document.getElementById('msrTotalFreight').textContent = formatCurrency(totals.freight);
    
    const netIncomeElement = document.getElementById('msrNetIncome');
    netIncomeElement.textContent = formatCurrency(totals.netIncome);
    netIncomeElement.style.color = totals.netIncome >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
}

function updateMSRTable() {
    const tbody = document.getElementById('msrTableBody');
    
    if (msrReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No MSR data found</td></tr>';
        return;
    }
    
    tbody.innerHTML = msrReports.map(report => {
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
        
        // Calculate MSR split (50% + remainder if odd)
        const s3Boxes = Math.floor(totalBoxes / 2);
        const msrBoxes = totalBoxes - s3Boxes;
        const msrRatio = totalBoxes > 0 ? msrBoxes / totalBoxes : 0;
        
        // Split ALL values proportionally for MSR
        const msrSales = totalSales * msrRatio;
        const msrCost = cost * msrRatio;
        const msrTotalCost = totalCost * msrRatio;
        const msrAirCargo = airCargo * msrRatio;
        
        const freightCargo = msrTotalCost * 0.08;
        const freightAir = msrAirCargo;
        const totalExpenses = msrTotalCost + freightCargo + freightAir;
        const netIncome = msrSales - totalExpenses;
        const profitMargin = msrSales > 0 ? (netIncome / msrSales) * 100 : 0;
        
        return `
            <tr>
                <td>${formatDate(report.report_date)}</td>
                <td>${msrBoxes}</td>
                <td>${formatCurrency(msrSales)}</td>
                <td>${formatCurrency(totalExpenses)}</td>
                <td>${formatCurrency(msrCost)}</td>
                <td>${formatCurrency(freightCargo + freightAir)}</td>
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

function updateMSRCharts() {
    updateMSRRevenueChart();
    updateMSRCostChart();
}

function updateMSRRevenueChart() {
    const ctx = document.getElementById('msrRevenueChart').getContext('2d');
    
    if (msrRevenueChart) {
        msrRevenueChart.destroy();
    }
    
    const labels = msrReports.map(report => formatDate(report.report_date));
    const revenueData = msrReports.map(report => parseFloat(report.salles) || 0);
    const netIncomeData = msrReports.map(report => {
        const sales = parseFloat(report.salles) || 0;
        const totalCost = parseFloat(report.total_cost) || 0;
        const freight = totalCost * 0.08;
        return sales - (totalCost + freight);
    });
    
    msrRevenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    borderColor: '#9b59b6',
                    backgroundColor: 'rgba(155, 89, 182, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#9b59b6',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    tension: 0.4
                },
                {
                    label: 'Net Income',
                    data: netIncomeData,
                    borderColor: '#f39c12',
                    backgroundColor: 'rgba(243, 156, 18, 0.2)',
                    borderWidth: 3,
                    pointBackgroundColor: '#f39c12',
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
                    borderColor: '#9b59b6',
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

function updateMSRCostChart() {
    const ctx = document.getElementById('msrCostChart').getContext('2d');
    
    if (msrCostChart) {
        msrCostChart.destroy();
    }
    
    const costTotals = msrReports.reduce((acc, report) => {
        const totalCost = parseFloat(report.total_cost) || 0;
        const freightType = report.freight_type || '';
        const freightAmount = parseFloat(report.freight_amount) || 0;
        
        // Calculate MSR split (50% + remainder if odd)
        const totalBoxes = parseInt(report.boxes) || 0;
        const s3Boxes = Math.floor(totalBoxes / 2);
        const msrBoxes = totalBoxes - s3Boxes;
        const msrRatio = totalBoxes > 0 ? msrBoxes / totalBoxes : 0;
        const msrFreightAmount = freightAmount * msrRatio;
        
        acc.operationalCost += totalCost * msrRatio;
        
        if (freightType === 'cargo') {
            acc.freightCargo += msrFreightAmount;
        } else if (freightType === 'air') {
            acc.freightAir += msrFreightAmount;
        }
        
        return acc;
    }, { operationalCost: 0, freightCargo: 0, freightAir: 0 });
    
    msrCostChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Operational Cost', 'Freight Cargo', 'Freight Air'],
            datasets: [{
                data: [
                    costTotals.operationalCost, 
                    costTotals.freightCargo, 
                    costTotals.freightAir
                ],
                backgroundColor: [
                    '#16a085', // Teal for operational
                    '#3498db', // Blue for cargo
                    '#e74c3c'  // Red for air
                ],
                borderColor: [
                    '#138d75', // Darker teal border
                    '#2980b9', // Darker blue border
                    '#c0392b'  // Darker red border
                ],
                borderWidth: 3,
                hoverBackgroundColor: [
                    '#48c9b0', // Lighter teal on hover
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
                    borderColor: '#16a085',
                    borderWidth: 1
                }
            },
            maintainAspectRatio: false
        }
    });
}

function updateMSRSummary() {
    if (msrReports.length === 0) {
        document.getElementById('msrTotalBoxesSum').textContent = '0';
        document.getElementById('msrTotalNetIncomeSum').textContent = formatCurrency(0);
        document.getElementById('msrAvgProfitMargin').textContent = '0%';
        document.getElementById('msrAvgRevenuePerBox').textContent = formatCurrency(0);
        return;
    }
    
    const totals = msrReports.reduce((acc, report) => {
        const sales = parseFloat(report.salles) || 0;
        const totalCost = parseFloat(report.total_cost) || 0;
        const freight = totalCost * 0.08;
        const totalExpenses = totalCost + freight;
        const netIncome = sales - totalExpenses;
        const profitMargin = sales > 0 ? (netIncome / sales) * 100 : 0;
        const boxes = parseInt(report.boxes) || 0;
        
        acc.totalBoxes += boxes;
        acc.totalNetIncome += netIncome;
        acc.profitMargin += profitMargin;
        acc.revenuePerBox += boxes > 0 ? sales / boxes : 0;
        
        return acc;
    }, { totalBoxes: 0, totalNetIncome: 0, profitMargin: 0, revenuePerBox: 0 });
    
    const avgProfitMargin = totals.profitMargin / msrReports.length;
    const avgRevenuePerBox = totals.revenuePerBox / msrReports.length;
    
    document.getElementById('msrTotalBoxesSum').textContent = totals.totalBoxes;
    
    const netIncomeElement = document.getElementById('msrTotalNetIncomeSum');
    netIncomeElement.textContent = formatCurrency(totals.totalNetIncome);
    netIncomeElement.style.color = totals.totalNetIncome >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    
    const profitMarginElement = document.getElementById('msrAvgProfitMargin');
    profitMarginElement.textContent = avgProfitMargin.toFixed(2) + '%';
    profitMarginElement.style.color = avgProfitMargin >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    
    document.getElementById('msrAvgRevenuePerBox').textContent = formatCurrency(avgRevenuePerBox);
}

function applyMSRFilters() {
    const fromDate = document.getElementById('msrFilterFromDate').value;
    const toDate = document.getElementById('msrFilterToDate').value;
    
    const filters = {};
    if (fromDate) filters.date_from = fromDate;
    if (toDate) filters.date_to = toDate;
    
    loadMSRData(filters);
}

function clearMSRFilters() {
    document.getElementById('msrFilterFromDate').value = '';
    document.getElementById('msrFilterToDate').value = '';
    loadMSRData();
}

function exportMSRData() {
    if (msrReports.length === 0) {
        alert('No MSR data to export');
        return;
    }
    
    // Create CSV content
    const headers = [
        'Date', 'Boxes', 'Sales', 'Expenses', 'Cost', 'Freight', 'Net Income', 'Profit Margin'
    ];
    
    const csvContent = [
        headers.join(','),
        ...msrReports.map(report => {
            const sales = parseFloat(report.salles) || 0;
            const totalCost = parseFloat(report.total_cost) || 0;
            const cost = parseFloat(report.cost) || 0;
            const freight = totalCost * 0.08;
            const totalExpenses = totalCost + freight;
            const netIncome = sales - totalExpenses;
            const profitMargin = sales > 0 ? (netIncome / sales) * 100 : 0;
            
            return [
                report.report_date,
                report.boxes || 0,
                sales,
                totalExpenses,
                cost,
                freight,
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
    a.download = `fish-pro-msr-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showMSRError(message) {
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
