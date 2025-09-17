<?php
include_once '../config/database.php';
include_once 'auth.php';

class Inventory {
    private $conn;
    private $table_name = "inventory";
    private $transactions_table = "inventory_transactions";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $query = "SELECT i.*, u.username as updated_by_name FROM " . $this->table_name . " i 
                  LEFT JOIN users u ON i.updated_by = u.id 
                  ORDER BY i.item_name";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id) {
        $query = "SELECT * FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (item_name, current_stock, min_threshold, unit, cost_per_unit, updated_by) 
                  VALUES (?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        
        if($stmt->execute([
            $data['item_name'],
            $data['current_stock'],
            $data['min_threshold'],
            $data['unit'],
            $data['cost_per_unit'],
            $data['updated_by']
        ])) {
            $inventory_id = $this->conn->lastInsertId();
            $this->logTransaction($inventory_id, 'add', $data['current_stock'], 0, $data['current_stock'], 'Initial stock', $data['updated_by']);
            return true;
        }
        return false;
    }

    public function update($id, $data) {
        $current = $this->getById($id);
        
        $query = "UPDATE " . $this->table_name . " 
                  SET item_name=?, current_stock=?, min_threshold=?, unit=?, cost_per_unit=?, updated_by=?
                  WHERE id = ?";
        
        $stmt = $this->conn->prepare($query);
        
        if($stmt->execute([
            $data['item_name'],
            $data['current_stock'],
            $data['min_threshold'],
            $data['unit'],
            $data['cost_per_unit'],
            $data['updated_by'],
            $id
        ])) {
            if($current['current_stock'] != $data['current_stock']) {
                $change = $data['current_stock'] - $current['current_stock'];
                $this->logTransaction($id, 'update', $change, $current['current_stock'], $data['current_stock'], 'Stock updated', $data['updated_by']);
            }
            return true;
        }
        return false;
    }

    public function updateStock($id, $quantity_change, $notes, $user_id) {
        $current = $this->getById($id);
        $new_stock = $current['current_stock'] + $quantity_change;
        
        if($new_stock < 0) {
            return array('success' => false, 'message' => 'Insufficient stock');
        }

        $query = "UPDATE " . $this->table_name . " SET current_stock = ?, updated_by = ? WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        
        if($stmt->execute([$new_stock, $user_id, $id])) {
            $transaction_type = $quantity_change > 0 ? 'add' : 'remove';
            $this->logTransaction($id, $transaction_type, $quantity_change, $current['current_stock'], $new_stock, $notes, $user_id);
            return array('success' => true, 'message' => 'Stock updated successfully');
        }
        return array('success' => false, 'message' => 'Failed to update stock');
    }

    public function delete($id) {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([$id]);
    }

    public function getStockAlerts() {
        $query = "SELECT * FROM " . $this->table_name . " 
                  WHERE current_stock <= min_threshold 
                  ORDER BY current_stock ASC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getTransactionHistory($inventory_id = null, $limit = 50) {
        $query = "SELECT t.*, i.item_name, u.username as created_by_name 
                  FROM " . $this->transactions_table . " t
                  LEFT JOIN " . $this->table_name . " i ON t.inventory_id = i.id
                  LEFT JOIN users u ON t.created_by = u.id";
        
        $params = [];
        if($inventory_id) {
            $query .= " WHERE t.inventory_id = ?";
            $params[] = $inventory_id;
        }
        
        $query .= " ORDER BY t.created_at DESC LIMIT ?";
        $params[] = $limit;
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function logTransaction($inventory_id, $type, $quantity_change, $previous_stock, $new_stock, $notes, $user_id) {
        $query = "INSERT INTO " . $this->transactions_table . " 
                  (inventory_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$inventory_id, $type, $quantity_change, $previous_stock, $new_stock, $notes, $user_id]);
    }
}

// Handle API requests
$database = new Database();
$db = $database->getConnection();
$auth = new Auth($db);
$inventory = new Inventory($db);

if(!$auth->isLoggedIn()) {
    echo json_encode(array('success' => false, 'message' => 'Not authenticated'));
    exit;
}

if(!$auth->hasPermission('inventory')) {
    echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        if(isset($_GET['action'])) {
            switch($_GET['action']) {
                case 'alerts':
                    $data = $inventory->getStockAlerts();
                    echo json_encode(array('success' => true, 'data' => $data));
                    break;
                case 'transactions':
                    $inventory_id = isset($_GET['inventory_id']) ? $_GET['inventory_id'] : null;
                    $data = $inventory->getTransactionHistory($inventory_id);
                    echo json_encode(array('success' => true, 'data' => $data));
                    break;
                case 'single':
                    $data = $inventory->getById($_GET['id']);
                    echo json_encode(array('success' => true, 'data' => $data));
                    break;
                default:
                    $data = $inventory->getAll();
                    echo json_encode(array('success' => true, 'data' => $data));
            }
        } else {
            $data = $inventory->getAll();
            echo json_encode(array('success' => true, 'data' => $data));
        }
        break;

    case 'POST':
        // Validate input data
        if (!$input) {
            echo json_encode(array('success' => false, 'message' => 'No data provided'));
            break;
        }
        
        $input['updated_by'] = $_SESSION['user_id'];
        
        if(isset($input['action']) && $input['action'] === 'update_stock') {
            // Validate required fields for stock update
            if (!isset($input['id']) || !isset($input['quantity_change'])) {
                echo json_encode(array('success' => false, 'message' => 'Missing required fields for stock update'));
                break;
            }
            
            $result = $inventory->updateStock($input['id'], $input['quantity_change'], $input['notes'] ?? '', $_SESSION['user_id']);
            echo json_encode($result);
        } else {
            // Validate required fields for creating new item
            $required_fields = ['item_name', 'current_stock', 'min_threshold', 'unit', 'cost_per_unit'];
            foreach ($required_fields as $field) {
                if (!isset($input[$field]) || $input[$field] === '') {
                    echo json_encode(array('success' => false, 'message' => "Missing required field: $field"));
                    exit;
                }
            }
            
            // Check for duplicate item names
            $existing_items = $inventory->getAll();
            foreach ($existing_items as $item) {
                if (strtolower($item['item_name']) === strtolower($input['item_name'])) {
                    echo json_encode(array('success' => false, 'message' => 'Item with this name already exists'));
                    exit;
                }
            }
            
            if($inventory->create($input)) {
                echo json_encode(array('success' => true, 'message' => 'Item added successfully'));
            } else {
                echo json_encode(array('success' => false, 'message' => 'Failed to add item'));
            }
        }
        break;

    case 'PUT':
        if (!$input || !isset($input['id'])) {
            echo json_encode(array('success' => false, 'message' => 'No data or ID provided'));
            break;
        }
        
        $id = $input['id'];
        unset($input['id']);
        $input['updated_by'] = $_SESSION['user_id'];
        
        // Validate required fields
        $required_fields = ['item_name', 'current_stock', 'min_threshold', 'unit', 'cost_per_unit'];
        foreach ($required_fields as $field) {
            if (!isset($input[$field]) || $input[$field] === '') {
                echo json_encode(array('success' => false, 'message' => "Missing required field: $field"));
                exit;
            }
        }
        
        if($inventory->update($id, $input)) {
            echo json_encode(array('success' => true, 'message' => 'Item updated successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to update item'));
        }
        break;

    case 'DELETE':
        if (!isset($_GET['id']) || empty($_GET['id'])) {
            echo json_encode(array('success' => false, 'message' => 'No ID provided'));
            break;
        }
        
        $id = $_GET['id'];
        
        // Check if item exists
        $item = $inventory->getById($id);
        if (!$item) {
            echo json_encode(array('success' => false, 'message' => 'Item not found'));
            break;
        }
        
        if($inventory->delete($id)) {
            echo json_encode(array('success' => true, 'message' => 'Item deleted successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to delete item'));
        }
        break;
}
?>
