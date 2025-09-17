<?php
include_once '../config/database.php';

class Auth {
    private $conn;
    private $table_name = "users";

    public function __construct($db) {
        $this->conn = $db;
    }

    public function login($username, $password) {
        $query = "SELECT id, username, password, role, permissions, is_active FROM " . $this->table_name . " WHERE username = ? AND is_active = 1";
        $stmt = $this->conn->prepare($query);
        $stmt->bindParam(1, $username);
        $stmt->execute();

        if($stmt->rowCount() > 0) {
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if(password_verify($password, $row['password']) || $password === $row['password']) {
                $_SESSION['user_id'] = $row['id'];
                $_SESSION['username'] = $row['username'];
                $_SESSION['role'] = $row['role'];
                $_SESSION['permissions'] = json_decode($row['permissions'], true);
                return array(
                    'success' => true,
                    'user' => array(
                        'id' => $row['id'],
                        'username' => $row['username'],
                        'role' => $row['role'],
                        'permissions' => json_decode($row['permissions'], true)
                    )
                );
            }
        }
        return array('success' => false, 'message' => 'Invalid credentials');
    }

    public function logout() {
        session_destroy();
        return array('success' => true, 'message' => 'Logged out successfully');
    }

    public function isLoggedIn() {
        return isset($_SESSION['user_id']);
    }

    public function hasPermission($section) {
        if(!$this->isLoggedIn()) return false;
        if($_SESSION['role'] === 'admin') return true;
        return in_array($section, $_SESSION['permissions'] ?? []);
    }

    public function getCurrentUser() {
        if($this->isLoggedIn()) {
            return array(
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'role' => $_SESSION['role'],
                'permissions' => $_SESSION['permissions']
            );
        }
        return null;
    }
}

// Handle API requests
$database = new Database();
$db = $database->getConnection();
$auth = new Auth($db);

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

switch($method) {
    case 'POST':
        if(isset($input['action'])) {
            switch($input['action']) {
                case 'login':
                    $result = $auth->login($input['username'], $input['password']);
                    echo json_encode($result);
                    break;
                case 'logout':
                    $result = $auth->logout();
                    echo json_encode($result);
                    break;
                case 'check_session':
                    if($auth->isLoggedIn()) {
                        echo json_encode(array('success' => true, 'user' => $auth->getCurrentUser()));
                    } else {
                        echo json_encode(array('success' => false));
                    }
                    break;
                case 'check_permission':
                    $hasPermission = $auth->hasPermission($input['section']);
                    echo json_encode(array('success' => true, 'hasPermission' => $hasPermission));
                    break;
            }
        }
        break;
}
?>
