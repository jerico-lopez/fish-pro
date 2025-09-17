<?php
include_once '../config/database.php';
include_once 'auth.php';

class Users {
    private $conn;
    private $table_name = "users";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getAll() {
        $query = "SELECT id, username, email, role, permissions, created_at, is_active FROM " . $this->table_name . " ORDER BY created_at DESC";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id) {
        $query = "SELECT id, username, email, role, permissions, created_at, is_active FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function create($data) {
        $query = "INSERT INTO " . $this->table_name . " 
                  (username, password, email, role, permissions) 
                  VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        $hashed_password = password_hash($data['password'], PASSWORD_DEFAULT);
        $permissions_json = json_encode($data['permissions']);
        
        return $stmt->execute([
            $data['username'],
            $hashed_password,
            $data['email'],
            $data['role'],
            $permissions_json
        ]);
    }

    public function update($id, $data) {
        $query = "UPDATE " . $this->table_name . " 
                  SET username=?, email=?, role=?, permissions=?";
        $params = [
            $data['username'],
            $data['email'],
            $data['role'],
            json_encode($data['permissions'])
        ];

        if(isset($data['password']) && !empty($data['password'])) {
            $query .= ", password=?";
            $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
        }

        $query .= " WHERE id = ?";
        $params[] = $id;
        
        $stmt = $this->conn->prepare($query);
        return $stmt->execute($params);
    }

    public function delete($id) {
        // Don't allow deletion of admin user
        $user = $this->getById($id);
        if($user && $user['username'] === 'admin') {
            return false;
        }
        
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([$id]);
    }

    public function toggleStatus($id) {
        $query = "UPDATE " . $this->table_name . " SET is_active = NOT is_active WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([$id]);
    }

    public function usernameExists($username, $exclude_id = null) {
        $query = "SELECT COUNT(*) FROM " . $this->table_name . " WHERE username = ?";
        $params = [$username];
        
        if($exclude_id) {
            $query .= " AND id != ?";
            $params[] = $exclude_id;
        }
        
        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchColumn() > 0;
    }
}

// Handle API requests
$database = new Database();
$db = $database->getConnection();
$auth = new Auth($db);
$users = new Users($db);

if(!$auth->isLoggedIn()) {
    echo json_encode(array('success' => false, 'message' => 'Not authenticated'));
    exit;
}

if(!$auth->hasPermission('manage_users')) {
    echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'GET':
        if(isset($_GET['action']) && $_GET['action'] === 'single') {
            $data = $users->getById($_GET['id']);
            echo json_encode(array('success' => true, 'data' => $data));
        } else {
            $data = $users->getAll();
            echo json_encode(array('success' => true, 'data' => $data));
        }
        break;

    case 'POST':
        // Check if username already exists
        if($users->usernameExists($input['username'])) {
            echo json_encode(array('success' => false, 'message' => 'Username already exists'));
            break;
        }
        
        if($users->create($input)) {
            echo json_encode(array('success' => true, 'message' => 'User created successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to create user'));
        }
        break;

    case 'PUT':
        $id = $input['id'];
        unset($input['id']);
        
        // Check if username already exists (excluding current user)
        if($users->usernameExists($input['username'], $id)) {
            echo json_encode(array('success' => false, 'message' => 'Username already exists'));
            break;
        }
        
        if($users->update($id, $input)) {
            echo json_encode(array('success' => true, 'message' => 'User updated successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to update user'));
        }
        break;

    case 'DELETE':
        $id = $_GET['id'];
        
        if($users->delete($id)) {
            echo json_encode(array('success' => true, 'message' => 'User deleted successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Cannot delete admin user or failed to delete'));
        }
        break;
}
?>
