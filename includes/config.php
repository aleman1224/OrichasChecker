<?php
// Configuración de la base de datos
define('MONGO_URI', 'tu_uri_de_mongodb');
define('DB_NAME', 'alemanChecker');

// Configuración de seguridad
session_start();
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Funciones de utilidad
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        header('Location: /login.html');
        exit;
    }
}
?> 