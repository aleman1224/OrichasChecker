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
    'ADMIN_KEY',
    'TELEGRAM_TOKEN',
    'TELEGRAM_CHAT_ID',
    'PUPPETEER_SKIP_CHROMIUM_DOWNLOAD',
    'CHROME_BIN'
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
    'railway.toml',
    'Dockerfile',
    '.env'
];

// Directorios requeridos
const requiredDirs = [
    'models',
    'public',
    'cards',
    'logs'
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

    // Verificar formato de MongoDB URI
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.startsWith('mongodb+srv://') && !mongoUri.startsWith('mongodb://')) {
        console.error('❌ MONGODB_URI no tiene un formato válido');
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
    const notWritableDirs = [];

    for (const dir of requiredDirs) {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            missingDirs.push(dir);
            continue;
        }

        try {
            fs.accessSync(dirPath, fs.constants.W_OK);
        } catch (error) {
            notWritableDirs.push(dir);
        }
    }

    if (missingDirs.length > 0) {
        console.error('❌ Faltan los siguientes directorios:');
        missingDirs.forEach(dir => console.error(`   - ${dir}`));
        return false;
    }

    if (notWritableDirs.length > 0) {
        console.error('❌ Los siguientes directorios no tienen permisos de escritura:');
        notWritableDirs.forEach(dir => console.error(`   - ${dir}`));
        return false;
    }

    console.log('✅ Todos los directorios requeridos están presentes y con permisos correctos');
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
            'puppeteer-core',
            'dotenv',
            '@faker-js/faker',
            'node-telegram-bot-api'
        ];
        
        const missingDeps = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
        
        if (missingDeps.length > 0) {
            console.error('❌ Faltan las siguientes dependencias en package.json:');
            missingDeps.forEach(dep => console.error(`   - ${dep}`));
            return false;
        }

        // Verificar versión de Node
        if (!packageJson.engines || !packageJson.engines.node) {
            console.error('❌ Falta la especificación de versión de Node en engines');
            return false;
        }
        
        console.log('✅ package.json está correctamente configurado');
        return true;
    } catch (error) {
        console.error('❌ Error al leer package.json:', error);
        return false;
    }
}

function checkDockerfile() {
    console.log('🔍 Verificando Dockerfile...');
    const dockerfilePath = path.join(__dirname, 'Dockerfile');
    
    try {
        const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
        
        // Verificar elementos requeridos en Dockerfile
        const requiredElements = [
            'FROM node:20-slim',
            'google-chrome-stable',
            'WORKDIR /app',
            'COPY package*.json',
            'npm ci --only=production',
            'COPY . .',
            'CMD ["node", "main.js"]'
        ];
        
        const missingElements = requiredElements.filter(element => !dockerfile.includes(element));
        
        if (missingElements.length > 0) {
            console.error('❌ Faltan los siguientes elementos en Dockerfile:');
            missingElements.forEach(element => console.error(`   - ${element}`));
            return false;
        }
        
        console.log('✅ Dockerfile está correctamente configurado');
        return true;
    } catch (error) {
        console.error('❌ Error al leer Dockerfile:', error);
        return false;
    }
}

function main() {
    console.log('🚀 Iniciando verificación pre-despliegue...\n');
    
    const checks = [
        checkEnvVars(),
        checkFiles(),
        checkDirs(),
        checkPackageJson(),
        checkDockerfile()
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