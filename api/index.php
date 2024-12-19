<?php
header('Content-Type: application/json');
require_once('../includes/config.php');

try {
    $mongo = new MongoDB\Client(
        "mongodb+srv://<username>:<password>@<cluster-url>/alemanChecker?retryWrites=true&w=majority"
    );
    $db = $mongo->alemanChecker;
    
    switch($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            // Manejar login
            if ($_POST['action'] === 'login') {
                $users = $db->users;
                $user = $users->findOne(['username' => $_POST['username']]);
                
                if ($user && password_verify($_POST['password'], $user->password)) {
                    session_start();
                    $_SESSION['user_id'] = (string)$user->_id;
                    echo json_encode(['success' => true]);
                } else {
                    echo json_encode(['success' => false]);
                }
            }
            break;
    }
} catch(Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?> 