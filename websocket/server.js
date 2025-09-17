const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            switch(data.type) {
                case 'auth':
                    // Store user info with connection
                    clients.set(ws, {
                        userId: data.userId,
                        username: data.username,
                        role: data.role
                    });
                    ws.send(JSON.stringify({
                        type: 'auth_success',
                        message: 'Authenticated successfully'
                    }));
                    break;
                    
                case 'inventory_alert':
                    // Broadcast inventory alerts to all connected admin users
                    broadcastToAdmins({
                        type: 'inventory_alert',
                        data: data.data
                    });
                    break;
                    
                case 'new_report':
                    // Broadcast new report notification
                    broadcastToAll({
                        type: 'new_report',
                        data: data.data,
                        user: clients.get(ws)?.username || 'Unknown'
                    });
                    break;
                    
                case 'user_activity':
                    // Broadcast user activity updates
                    broadcastToAdmins({
                        type: 'user_activity',
                        data: data.data
                    });
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

function broadcastToAll(message) {
    clients.forEach((clientInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        }
    });
}

function broadcastToAdmins(message) {
    clients.forEach((clientInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN && clientInfo.role === 'admin') {
            ws.send(JSON.stringify(message));
        }
    });
}

function broadcastToUser(userId, message) {
    clients.forEach((clientInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN && clientInfo.userId === userId) {
            ws.send(JSON.stringify(message));
        }
    });
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
