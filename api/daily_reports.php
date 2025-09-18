<?php
include_once '../config/database.php';
include_once 'auth.php';

class DailyReports
{
    private $conn;
    private $table_name = "daily_reports";

    public function __construct($db)
    {
        $this->conn = $db;
    }

    // Check if a column exists in the target table (for forward/backward compatibility)
    private function hasColumn($columnName)
    {
        $stmt = $this->conn->prepare("SHOW COLUMNS FROM " . $this->table_name . " LIKE ?");
        $stmt->execute([$columnName]);
        return $stmt->rowCount() > 0;
    }

    public function create($data)
    {
        $columns = [
            'user_id',
            'report_date',
            'boxes',
            'salles',
            'fish',
            'ice_chest',
            'plastic',
            'tape',
            'ice',
            'labor',
            'total_cost',
            'sales_per_box',
            'cost_per_box',
            'air_cargo',
        ];
        $values = [
            $data['user_id'] ?? null,
            $data['report_date'] ?? null,
            $data['boxes'] ?? 0,
            $data['salles'] ?? 0,
            $data['fish'] ?? 0,
            $data['ice_chest'] ?? 0,
            $data['plastic'] ?? 0,
            $data['tape'] ?? 0,
            $data['ice'] ?? 0,
            $data['labor'] ?? 0,
            $data['total_cost'] ?? 0,
            $data['sales_per_box'] ?? 0,
            $data['cost_per_box'] ?? 0,
            $data['air_cargo'] ?? 0,
        ];

        $placeholders = rtrim(str_repeat('?, ', count($columns)), ', ');
        $query = "INSERT INTO " . $this->table_name . " (" . implode(',', $columns) . ") VALUES (" . $placeholders . ")";

        $stmt = $this->conn->prepare($query);
        return $stmt->execute($values);
    }

    public function checkInventoryAvailability($data)
    {
        // Map report fields to inventory items
        $inventoryMapping = [
            // 'fish' => 'Fish', Removed
            'ice' => 'Ice',
            'plastic' => 'Plastic',
            'tape' => 'Tape',
            'ice_chest' => 'Ice Chest',
            // 'boxes' => 'Box' Removed
        ];

        foreach ($inventoryMapping as $reportField => $inventoryItem) {
            if (isset($data[$reportField]) && $data[$reportField] > 0) {
                $query = "SELECT current_stock FROM inventory WHERE item_name = ?";
                $stmt = $this->conn->prepare($query);
                $stmt->execute([$inventoryItem]);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$result || $result['current_stock'] < $data[$reportField]) {
                    return [
                        'success' => false,
                        'message' => "Insufficient stock for {$inventoryItem}. Available: " . ($result['current_stock'] ?? 0) . ", Required: " . $data[$reportField]
                    ];
                }
            }
        }

        return ['success' => true];
    }

    public function deductInventory($data, $userId)
    {
        // Map report fields to inventory items
        $inventoryMapping = [
            // 'fish' => 'Fish', Removed
            'ice' => 'Ice',
            'plastic' => 'Plastic',
            'tape' => 'Tape',
            'ice_chest' => 'Ice Chest',
            // 'boxes' => 'Box' Removed
        ];

        foreach ($inventoryMapping as $reportField => $inventoryItem) {
            if (isset($data[$reportField]) && $data[$reportField] > 0) {
                // Get current inventory item
                $query = "SELECT id, current_stock FROM inventory WHERE item_name = ?";
                $stmt = $this->conn->prepare($query);
                $stmt->execute([$inventoryItem]);
                $inventory = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($inventory) {
                    $newStock = $inventory['current_stock'] - $data[$reportField];

                    // Update inventory stock
                    $updateQuery = "UPDATE inventory SET current_stock = ?, updated_by = ? WHERE id = ?";
                    $updateStmt = $this->conn->prepare($updateQuery);
                    $updateStmt->execute([$newStock, $userId, $inventory['id']]);

                    // Log transaction
                    $transactionQuery = "INSERT INTO inventory_transactions 
                                       (inventory_id, transaction_type, quantity_change, previous_stock, new_stock, notes, created_by) 
                                       VALUES (?, 'remove', ?, ?, ?, ?, ?)";
                    $transactionStmt = $this->conn->prepare($transactionQuery);
                    $transactionStmt->execute([
                        $inventory['id'],
                        -$data[$reportField],
                        $inventory['current_stock'],
                        $newStock,
                        "Used in daily fish report on " . $data['report_date'],
                        $userId
                    ]);
                }
            }
        }
    }

    public function getAll($filters = [])
    {
        $query = "SELECT dr.*, u.username FROM " . $this->table_name . " dr 
                  LEFT JOIN users u ON dr.user_id = u.id WHERE 1=1";
        $params = [];

        if (isset($filters['date_from'])) {
            $query .= " AND dr.report_date >= ?";
            $params[] = $filters['date_from'];
        }
        if (isset($filters['date_to'])) {
            $query .= " AND dr.report_date <= ?";
            $params[] = $filters['date_to'];
        }
        if (isset($filters['user_id'])) {
            $query .= " AND dr.user_id = ?";
            $params[] = $filters['user_id'];
        }

        $query .= " ORDER BY dr.report_date DESC, dr.created_at DESC";

        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById($id)
    {
        $query = "SELECT dr.*, u.username FROM " . $this->table_name . " dr 
                  LEFT JOIN users u ON dr.user_id = u.id 
                  WHERE dr.id = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    public function getInventoryStock()
    { // Removed Box
        $query = "SELECT item_name, current_stock, unit FROM inventory 
                  WHERE item_name IN ('Fish', 'Ice', 'Plastic', 'Tape', 'Ice Chest') 
                  ORDER BY item_name";
        $stmt = $this->conn->prepare($query);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function update($id, $data)
    {
        $setParts = [
            'boxes=?',
            'salles=?',
            'cost=?',
            'fish=?',
            'ice_chest=?',
            'plastic=?',
            'tape=?',
            'ice=?',
            'labor=?',
            'total_cost=?',
            'sales_per_box=?',
            'cost_per_box=?',
            'air_cargo=?',
        ];
        $params = [
            $data['boxes'],
            $data['salles'],
            $data['cost'],
            $data['fish'],
            $data['ice_chest'],
            $data['plastic'],
            $data['tape'],
            $data['ice'],
            $data['labor'],
            $data['total_cost'],
            $data['sales_per_box'],
            $data['cost_per_box'],
            $data['air_cargo'],
        ];

        $params[] = $id;
        $query = "UPDATE " . $this->table_name . " SET " . implode(', ', $setParts) . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute($params);
    }

    public function delete($id)
    {
        $query = "DELETE FROM " . $this->table_name . " WHERE id = ?";
        $stmt = $this->conn->prepare($query);
        return $stmt->execute([$id]);
    }

    public function getAggregatedData($filters = [])
    {
        $query = "SELECT 
                    SUM(boxes) as total_boxes,
                    SUM(salles) as total_sales,
                    SUM(cost + fish + ice_chest + plastic + tape + ice + labor) as total_expenses,
                    SUM(cost) as total_cost,
                    SUM(freight_msr + freight_bas_zam + freight_air_cargo + freight_t2_market) as total_freight_amount,
                    SUM(salles - (cost + fish + ice_chest + plastic + tape + ice + labor + freight_msr + freight_bas_zam + freight_air_cargo + freight_t2_market)) as total_net_income,
                    COUNT(*) as total_reports
                  FROM " . $this->table_name . " WHERE 1=1";
        $params = [];

        if (isset($filters['date_from'])) {
            $query .= " AND report_date >= ?";
            $params[] = $filters['date_from'];
        }
        if (isset($filters['date_to'])) {
            $query .= " AND report_date <= ?";
            $params[] = $filters['date_to'];
        }

        $stmt = $this->conn->prepare($query);
        $stmt->execute($params);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

// Handle API requests
$database = new Database();
$db = $database->getConnection();
$auth = new Auth($db);
$reports = new DailyReports($db);

if (!$auth->isLoggedIn()) {
    echo json_encode(array('success' => false, 'message' => 'Not authenticated'));
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
// Be tolerant to either JSON body or form-encoded payloads
$raw = file_get_contents('php://input');
$decoded = json_decode($raw, true);
$input = is_array($decoded) ? $decoded : (($_POST ?? null) ?: []);

function enrichReportsWithS3Msr($reports) {
    foreach ($reports as &$report) {
        $totalBoxes = isset($report['boxes']) ? (int)$report['boxes'] : 0;
        $totalSales = isset($report['salles']) ? (float)$report['salles'] : 0;
        $totalCost  = isset($report['total_cost']) ? (float)$report['total_cost'] : 0;
        $airCargo   = isset($report['air_cargo']) ? (float)$report['air_cargo'] : 0;

        $salesPerBox = $totalBoxes > 0 ? $totalSales / $totalBoxes : 0;
        $costPerBox  = $totalBoxes > 0 ? $totalCost / $totalBoxes : 0;

        $s3Boxes  = floor($totalBoxes / 2);
        $msrBoxes = $totalBoxes - $s3Boxes;

        // ---- S3
        $s3Cost          = $s3Boxes * $costPerBox;
        $freightBasZam   = 350 * $s3Boxes;
        $freightAirCargo = $totalBoxes > 0 ? ($airCargo / $totalBoxes) * $s3Boxes : 0;
        $freightT2Market = 140 * $s3Boxes;
        $s3Expenses      = $s3Cost + $freightBasZam + $freightT2Market + $freightAirCargo;
        $s3Sales         = $s3Boxes * $salesPerBox;
        $s3NetIncome     = $s3Sales - $s3Expenses;

        $report['s3'] = [
            'boxes'     => $s3Boxes,
            'sales'     => $s3Sales,
            'cost'      => $s3Cost,
            'expenses'  => $s3Expenses,
            'net_income'=> $s3NetIncome,
            'freight'   => [
                'bas_zam'   => $freightBasZam,
                'air_cargo' => $freightAirCargo,
                't2_market' => $freightT2Market,
            ]
        ];

        // ---- MSR
        $msrCost      = $msrBoxes * $costPerBox;
        $msrFreight   = 1800 * $msrBoxes;
        $msrExpenses  = $msrCost + $msrFreight;
        $msrSales     = $msrBoxes * $salesPerBox;
        $msrNetIncome = $msrSales - $msrExpenses;

        $report['msr'] = [
            'boxes'     => $msrBoxes,
            'sales'     => $msrSales,
            'cost'      => $msrCost,
            'expenses'  => $msrExpenses,
            'net_income'=> $msrNetIncome,
            'freight'   => $msrFreight,
        ];
    }

    return $reports;
}


switch ($method) {
    case 'POST':
        if (!$auth->hasPermission('daily_report')) {
            echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
            exit;
        }

        // Normalize and default input fields to avoid PHP notices that break JSON
        $data = array(
            'user_id' => $_SESSION['user_id'] ?? null,
            'report_date' => $input['report_date'] ?? null,
            'boxes' => isset($input['boxes']) ? (float) $input['boxes'] : 0,
            'salles' => isset($input['salles']) ? (float) $input['salles'] : 0,
            'cost' => isset($input['cost']) ? (float) $input['cost'] : 0,
            'fish' => isset($input['fish']) ? (float) $input['fish'] : 0,
            'ice_chest' => isset($input['ice_chest']) ? (float) $input['ice_chest'] : 0,
            'plastic' => isset($input['plastic']) ? (float) $input['plastic'] : 0,
            'tape' => isset($input['tape']) ? (float) $input['tape'] : 0,
            'ice' => isset($input['ice']) ? (float) $input['ice'] : 0,
            'labor' => isset($input['labor']) ? (float) $input['labor'] : 0,
            'total_cost' => isset($input['total_cost']) ? (float) $input['total_cost'] : 0,
            'sales_per_box' => isset($input['sales_per_box']) ? (float) $input['sales_per_box'] : 0,
            'cost_per_box' => isset($input['cost_per_box']) ? (float) $input['cost_per_box'] : 0,
            'air_cargo' => isset($input['air_cargo']) ? (float) $input['air_cargo'] : 0,
        );

        // Check inventory availability before creating report
        $inventoryCheck = $reports->checkInventoryAvailability($data);
        if (!$inventoryCheck['success']) {
            echo json_encode($inventoryCheck);
            break;
        }

        try {
            if ($reports->create($data)) {
                // Deduct inventory after successful report creation
                $reports->deductInventory($data, $_SESSION['user_id'] ?? null);
                echo json_encode(array('success' => true, 'message' => 'Report created successfully and inventory updated'));
            } else {
                echo json_encode(array('success' => false, 'message' => 'Failed to create report'));
            }
        } catch (Throwable $e) {
            echo json_encode(array('success' => false, 'message' => 'Database error: ' . $e->getMessage()));
        }
        break;

    case 'GET':
        if (!$auth->hasPermission('daily_report') && !$auth->hasPermission('ms3_msr') && !$auth->hasPermission('s3') && !$auth->hasPermission('msr')) {
            echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
            exit;
        }

        // Support fetching a single report by id for edit view
        if (isset($_GET['id'])) {
            $data = $reports->getById($_GET['id']);
            if ($data) {
                echo json_encode(array('success' => true, 'data' => $data));
            } else {
                echo json_encode(array('success' => false, 'message' => 'Report not found'));
            }
            break;
        }

        if (isset($_GET['action'])) {
            switch ($_GET['action']) {
                case 'history':
                    $filters = [];
                    if (isset($_GET['date_from']))
                        $filters['date_from'] = $_GET['date_from'];
                    if (isset($_GET['date_to']))
                        $filters['date_to'] = $_GET['date_to'];
                    if (isset($_GET['user_id']))
                        $filters['user_id'] = $_GET['user_id'];

                    $data = $reports->getAll($filters);
                    $data = enrichReportsWithS3Msr($data);
                    echo json_encode(array('success' => true, 'data' => $data));
                    break;
                case 'inventory_stock':
                    $data = $reports->getInventoryStock();
                    echo json_encode(array('success' => true, 'data' => $data));
                    break;
                default:
                    $data = $reports->getAll();
                    $data = enrichReportsWithS3Msr($data);
                    echo json_encode(['success' => true, 'data' => $data]);
            }
        } else {
            $data = $reports->getAll();
            $data = enrichReportsWithS3Msr($data);
            echo json_encode(array('success' => true, 'data' => $data));
        }
        break;

    case 'PUT':
        if (!$auth->hasPermission('daily_report')) {
            echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
            exit;
        }

        $id = $input['id'];
        unset($input['id']);

        if ($reports->update($id, $input)) {
            echo json_encode(array('success' => true, 'message' => 'Report updated successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to update report'));
        }
        break;

    case 'DELETE':
        if (!$auth->hasPermission('daily_report')) {
            echo json_encode(array('success' => false, 'message' => 'No access, please contact the developer'));
            exit;
        }

        $id = $_GET['id'];

        if ($reports->delete($id)) {
            echo json_encode(array('success' => true, 'message' => 'Report deleted successfully'));
        } else {
            echo json_encode(array('success' => false, 'message' => 'Failed to delete report'));
        }
        break;
}
?>