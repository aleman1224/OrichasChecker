import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
config();

// Variables requeridas
const requiredEnvVars = [
    'MONGODB_URI',
    'NODE_ENV',
    'PORT',
    'DOMAIN',
    'ADMIN_KEY',
    'TELEGRAM_TOKEN',
    'TELEGRAM_CHAT_ID',
    'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD'
];

// Archivos requeridos
const requiredFiles = [
    'main.js',
    'health.js',
    'ElegbaGate.js',
    'OshunGate.js',
    'logger.js',
    'utils.js',
    'package.json',
    'render.yaml',
    '.env'
];

// Directorios requeridos
const requiredDirs = [
    'models',
    'public',
    'cards'
];

function checkEnvVars() {
    console.log('🔍 Verificando variables de entorno...');
    const missingVars = [];

    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            missingVars.push(varName);
        }
    }

    if (missingVars.length > 0) {
        console.error('❌ Faltan las siguientes variables de entorno:');
        missingVars.forEach(varName => console.error(`   - ${varName}`));
        return false;
    }

    console.log('✅ Todas las variables de entorno están configuradas');
    return true;
}

function checkFiles() {
    console.log('🔍 Verificando archivos requeridos...');
    const missingFiles = [];

    for (const file of requiredFiles) {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            missingFiles.push(file);
        }
    }

    if (missingFiles.length > 0) {
        console.error('❌ Faltan los siguientes archivos:');
        missingFiles.forEach(file => console.error(`   - ${file}`));
        return false;
    }

    console.log('✅ Todos los archivos requeridos están presentes');
    return true;
}

function checkDirs() {
    console.log('🔍 Verificando directorios requeridos...');
    const missingDirs = [];

    for (const dir of requiredDirs) {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            missingDirs.push(dir);
        }
    }

    if (missingDirs.length > 0) {
        console.error('❌ Faltan los siguientes directorios:');
        missingDirs.forEach(dir => console.error(`   - ${dir}`));
        return false;
    }

    console.log('✅ Todos los directorios requeridos están presentes');
    return true;
}

function checkPackageJson() {
    console.log('🔍 Verificando package.json...');
    const packagePath = path.join(__dirname, 'package.json');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        
        // Verificar scripts requeridos
        const requiredScripts = ['start', 'build'];
        const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
        
        if (missingScripts.length > 0) {
            console.error('❌ Faltan los siguientes scripts en package.json:');
            missingScripts.forEach(script => console.error(`   - ${script}`));
            return false;
        }
        
        // Verificar dependencias requeridas
        const requiredDeps = [
            'express',
            'mongoose',
            'socket.io',
            'puppeteer',
            'dotenv'
        ];
        
        const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
        
        if (missingDeps.length > 0) {
            console.error('❌ Faltan las siguientes dependencias en package.json:');
            missingDeps.forEach(dep => console.error(`   - ${dep}`));
            return false;
        }
        
        console.log('✅ package.json está correctamente configurado');
        return true;
    } catch (error) {
        console.error('❌ Error al leer package.json:', error);
        return false;
    }
}

function main() {
    console.log('🚀 Iniciando verificación pre-despliegue...\n');
    
    const checks = [
        checkEnvVars(),
        checkFiles(),
        checkDirs(),
        checkPackageJson()
    ];
    
    if (checks.every(check => check)) {
        console.log('\n✅ Todo está listo para el despliegue!');
        process.exit(0);
    } else {
        console.error('\n❌ Hay problemas que deben ser resueltos antes del despliegue.');
        process.exit(1);
    }
}

main(); 