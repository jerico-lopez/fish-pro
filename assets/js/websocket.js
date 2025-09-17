// WebSocket connection management
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.isConnected = false;
    }

    connect() {
        try {
            this.ws = new WebSocket('ws://localhost:8080');
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Authenticate with current user info
                if (window.currentUser) {
                    this.send({
                        type: 'auth',
                        userId: window.currentUser.id,
                        username: window.currentUser.username,
                        role: window.currentUser.role
                    });
                }
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };

        } catch (error) {
            console.error('Failed to connect to WebSocket:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            setTimeout(() => {
                this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.log('Max reconnection attempts reached');
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket not connected, message not sent:', data);
        }
    }

    handleMessage(data) {
        switch (data.type) {
            case 'auth_success':
                console.log('WebSocket authentication successful');
                break;
                
            case 'inventory_alert':
                this.handleInventoryAlert(data.data);
                break;
                
            case 'new_report':
                this.handleNewReport(data);
                break;
                
            case 'user_activity':
                this.handleUserActivity(data.data);
                break;
                
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleInventoryAlert(alertData) {
        // Update notification badge
        this.updateNotificationBadge();
        
        // Show toast notification
        this.showToast(`Low stock alert: ${alertData.item_name} (${alertData.current_stock} remaining)`, 'warning');
        
        // Update inventory alerts on dashboard if present
        if (typeof updateInventoryAlerts === 'function') {
            updateInventoryAlerts();
        }
    }

    handleNewReport(data) {
        this.showToast(`New report added by ${data.user}`, 'info');
        
        // Refresh dashboard stats if on dashboard
        if (typeof loadDashboardStats === 'function') {
            loadDashboardStats();
        }
    }

    handleUserActivity(data) {
        // Handle user activity updates for admins
        if (window.currentUser && window.currentUser.role === 'admin') {
            this.showToast(`User activity: ${data.message}`, 'info');
        }
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            let count = parseInt(badge.textContent) || 0;
            count++;
            badge.textContent = count;
            badge.style.display = 'block';
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add toast styles if not already present
        if (!document.querySelector('#toastStyles')) {
            const style = document.createElement('style');
            style.id = 'toastStyles';
            style.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--card-color);
                    border-radius: var(--border-radius);
                    box-shadow: var(--shadow);
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    z-index: 3000;
                    min-width: 300px;
                    border-left: 4px solid;
                    animation: slideIn 0.3s ease-out;
                }
                .toast-info { border-left-color: var(--info-color); }
                .toast-warning { border-left-color: var(--warning-color); }
                .toast-success { border-left-color: var(--success-color); }
                .toast-danger { border-left-color: var(--danger-color); }
                .toast-content { flex: 1; display: flex; align-items: center; gap: 10px; }
                .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            info: 'info-circle',
            warning: 'exclamation-triangle',
            success: 'check-circle',
            danger: 'exclamation-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Send inventory alert
    sendInventoryAlert(alertData) {
        this.send({
            type: 'inventory_alert',
            data: alertData
        });
    }

    // Send new report notification
    sendNewReport(reportData) {
        this.send({
            type: 'new_report',
            data: reportData
        });
    }

    // Send user activity notification
    sendUserActivity(activityData) {
        this.send({
            type: 'user_activity',
            data: activityData
        });
    }
}

// Global WebSocket instance
let wsManager = null;

// Initialize WebSocket when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if user is authenticated
    if (window.currentUser) {
        wsManager = new WebSocketManager();
        wsManager.connect();
    }
});

// Initialize WebSocket after authentication
function initializeWebSocket() {
    if (!wsManager) {
        wsManager = new WebSocketManager();
        wsManager.connect();
    }
}
