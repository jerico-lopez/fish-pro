<?php
// Setup Required Inventory Items
include_once 'config/database.php';

$database = new Database();
$db = $database->getConnection();

// Required inventory items for daily fish reports
$requiredItems = [
    ['name' => 'Fish', 'stock' => 100, 'threshold' => 20, 'unit' => 'kg', 'cost' => 150.00],
    ['name' => 'Ice', 'stock' => 50, 'threshold' => 10, 'unit' => 'bags', 'cost' => 25.00],
    ['name' => 'Plastic', 'stock' => 150, 'threshold' => 30, 'unit' => 'pcs', 'cost' => 2.00],
    ['name' => 'Tape', 'stock' => 20, 'threshold' => 5, 'unit' => 'rolls', 'cost' => 15.00],
    ['name' => 'Ice Chest', 'stock' => 10, 'threshold' => 2, 'unit' => 'pcs', 'cost' => 500.00],
    ['name' => 'Box', 'stock' => 200, 'threshold' => 50, 'unit' => 'pcs', 'cost' => 5.00]
];

try {
    echo "<h2>Setting up required inventory items...</h2>\n";
    
    foreach ($requiredItems as $item) {
        // Check if item already exists
        $checkQuery = "SELECT id, current_stock FROM inventory WHERE item_name = ?";
        $checkStmt = $db->prepare($checkQuery);
        $checkStmt->execute([$item['name']]);
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existing) {
            // Item exists, update if stock is 0
            if ($existing['current_stock'] == 0) {
                $updateQuery = "UPDATE inventory SET current_stock = ?, min_threshold = ?, unit = ?, cost_per_unit = ? WHERE id = ?";
                $updateStmt = $db->prepare($updateQuery);
                $updateStmt->execute([$item['stock'], $item['threshold'], $item['unit'], $item['cost'], $existing['id']]);
                echo "✅ Updated {$item['name']} with stock: {$item['stock']} {$item['unit']}<br>\n";
            } else {
                echo "ℹ️ {$item['name']} already exists with stock: {$existing['current_stock']}<br>\n";
            }
        } else {
            // Item doesn't exist, create it
            $insertQuery = "INSERT INTO inventory (item_name, current_stock, min_threshold, unit, cost_per_unit) VALUES (?, ?, ?, ?, ?)";
            $insertStmt = $db->prepare($insertQuery);
            $insertStmt->execute([$item['name'], $item['stock'], $item['threshold'], $item['unit'], $item['cost']]);
            echo "✅ Created {$item['name']} with stock: {$item['stock']} {$item['unit']}<br>\n";
        }
    }
    
    echo "<h3>✅ Inventory setup completed successfully!</h3>\n";
    echo "<p><a href='inventory.html'>Go to Inventory Management</a> | <a href='daily-report.html'>Go to Daily Report</a></p>\n";
    
} catch (Exception $e) {
    echo "<h3>❌ Error setting up inventory:</h3>\n";
    echo "<p>" . $e->getMessage() . "</p>\n";
}
?>
