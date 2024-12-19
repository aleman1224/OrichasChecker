import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { User } from './models/User.js';
import { Key } from './models/Key.js';
import logger from './logger.js';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import request from 'request';
import { ElegbaGateChecker, main } from './ElegbaGate.js';
import OshunGateChecker, { runOshunGate } from './OshunGate.js';
import { Live } from './models/Live.js';
import fs from 'fs';
import { config } from 'dotenv';
import session from 'express-session';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'mongo-sanitize';
import { protect } from './utils.js';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';

// Cargar variables de entorno
config();

// Si no existe en .env, establecer una por defecto
if (!process.env.ADMIN_KEY) {
    process.env.ADMIN_KEY = 'ALEMAN2024'; // Puedes cambiar esta clave
}

const app = express();

// Configurar sesiones (DEBE IR AQUÍ AL INICIO)
app.use(session({
    secret: 'ALEMAN2024',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

const server = createServer(app); // Define el servidor HTTP antes de usarlo
const io = new Server(server, {
    cors: {
        origin: "*",  // Permitir cualquier origen
        methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket'],
    pingTimeout: 60000,
    pingInterval: 25000,
    cookie: true
}); 

global.io = io;

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let checkerRunning = false;
let checkerInstance = null;
let checkerProcess = null; // Para mantener referencia al proceso del checker

// Al inicio del archivo, después de las importaciones
global.checkerActivo = false;
global.stopSignal = false;

// Ocultar y proteger la conexión MongoDB
const MONGO_CONFIG = {
    user: Buffer.from('alemanApp').toString('base64'),
    pass: Buffer.from('ALEMAN1988').toString('base64'),
    host: Buffer.from('127.0.0.1').toString('base64'),
    port: Buffer.from('27017').toString('base64'),
    db: Buffer.from('alemanChecker').toString('base64')
};

// Función para decodificar credenciales
const getMongoUrl = () => {
    const decode = str => Buffer.from(str, 'base64').toString();
    return `mongodb://${decode(MONGO_CONFIG.user)}:${decode(MONGO_CONFIG.pass)}@${decode(MONGO_CONFIG.host)}:${decode(MONGO_CONFIG.port)}/${decode(MONGO_CONFIG.db)}?authSource=${decode(MONGO_CONFIG.db)}`;
};

// Configuración adicional de MongoDB
mongoose.connect(getMongoUrl(), {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    ssl: process.env.NODE_ENV === 'production',
    sslValidate: process.env.NODE_ENV === 'production',
    retryWrites: true,
    maxPoolSize: 10
}).then(() => {
    logger.success('Conectado a MongoDB');
}).catch(err => {
    logger.error('Error conectando a MongoDB:', err);
});

// Agregar el nuevo gate al objeto de gates disponibles
const gates = {
    elegba: ElegbaGateChecker,
    oshun: OshunGateChecker
    // ... otros gates existentes
};

function actualizarDashboard(tipo, data) {
    const mensaje = {
        tipo: tipo,
        data: data,
        mensaje: typeof data === 'string' ? data : JSON.stringify(data)
    };
    
    console.log('Enviando actualización:', mensaje);
    io.emit('update-dashboard', mensaje);
}
// 1. Primero los middlewares básicos
app.use(express.json());

// 2. CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// 3. Ruta para cargar tarjetas
app.post('/api/load-cards', (req, res) => {
    try {
        const { tarjetas } = req.body;
        
        if (!tarjetas) {
            return res.status(400).json({ success: false, message: 'No hay tarjetas' });
        }

        // Actualizar la ruta para que coincida
        const cardsPath = path.join(__dirname, 'cards', 'tarjetas.txt');
        
        // Asegurarse de que el directorio existe
        if (!fs.existsSync(path.dirname(cardsPath))) {
            fs.mkdirSync(path.dirname(cardsPath), { recursive: true });
        }

        // Escribir las tarjetas
        fs.writeFileSync(cardsPath, tarjetas);
        
        res.json({ success: true, message: 'Tarjetas guardadas' });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, message: 'Error al guardar' });
    }
});

// 4. Archivos estáticos al final
app.use(express.static(path.join(__dirname, 'public')));

// 5. Todas las rutas API
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    setInterval(() => {
        res.write(`data: ${JSON.stringify({ message: 'Evento de prueba' })}\n\n`);
    }, 1000);
});

// 6. Rutas de páginas al final
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Proxy para binlist
app.use('/proxy-binlist', (req, res) => {
    const url = `https://lookup.binlist.net${req.url}`;
    req.pipe(request(url)).pipe(res);
});

// Ruta para iniciar sesión
app.post('/api/login', async (req, res) => {
    const ip = req.ip;
    const attempts = loginAttempts.get(ip) || { count: 0, timestamp: Date.now() };

    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        const timeLeft = LOCKOUT_TIME - (Date.now() - attempts.timestamp);
        if (timeLeft > 0) {
            return res.status(429).json({
                success: false,
                message: `Cuenta bloqueada. Intente en ${Math.ceil(timeLeft/60000)} minutos`
            });
        }
        loginAttempts.delete(ip);
    }

    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        
        if (!user || password !== user.password) {
            attempts.count++;
            attempts.timestamp = Date.now();
            loginAttempts.set(ip, attempts);
            return res.status(401).json({ success: false });
        }
        
        req.session.userId = user._id;
        
        res.json({ 
            success: true,
            userId: user._id,  // Enviar el userId al frontend
            message: 'Inicio de sesión exitoso' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// Ruta para registrar usuario
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, key } = req.body;

        // Verificar que la clave existe y es válida
        const keyDoc = await Key.findOne({ key, used: false, expiresAt: { $gt: new Date() } });
        if (!keyDoc || !keyDoc.isValid()) {
            logger.warning(`Intento de registro con clave inválida: ${key}`);
            return res.status(400).json({ success: false, message: 'Clave de registro inválida o expirada' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'El nombre de usuario ya está en uso' });
        }

        // Crear nuevo usuario
        const user = new User({
            username,
            password,
            key,
            subscription: {
                startDate: new Date(),
                endDate: keyDoc.expiresAt,
                daysValidity: keyDoc.daysValidity,
                status: 'active'
            }
        });

        await user.save();

        // Marcar la clave como usada
        keyDoc.used = true;
        await keyDoc.save();

        logger.success(`Nuevo usuario registrado: ${username}`);
        res.json({ success: true, message: 'Usuario registrado exitosamente' });

    } catch (error) {
        logger.error('Error en registro:', error);
        res.status(500).json({ success: false, message: 'Error en el registro' });
    }
});

//funcion para iniciar el checker
app.post('/api/start-checker', async (req, res) => {
    try {
        // Verificar y reiniciar estado si es necesario
        if (checkerRunning || checkerInstance) {
            checkerRunning = false;
            checkerInstance = null;
            global.stopSignal = false;
            global.checkerActivo = false;
        }

        const { gateType, userId } = req.body;
        console.log('Iniciando checker con userId:', userId);
        
        if (gateType === 'elegbagate') {
            checkerInstance = new ElegbaGateChecker(userId);
            global.checkerActivo = true;
            checkerRunning = true;
            checkerProcess = main();
        } else if (gateType === 'oshungate') {
            checkerInstance = new OshunGateChecker(userId);
            global.checkerActivo = true;
            checkerRunning = true;
            checkerProcess = runOshunGate(userId).catch(error => {
                console.error('Error en OshunGate:', error);
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Tipo de gate no válido' 
            });
        }

        res.json({ success: true, message: 'Checker iniciado correctamente' });
        
    } catch (error) {
        console.error('Error al iniciar el checker:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error al iniciar el checker' 
        });
    }
});

app.post('/api/stop-checker', async (req, res) => {
    try {
        console.log('¡PARADA DE EMERGENCIA ACTIVADA!');
        
        // Activar señales de parada inmediatamente
        global.stopSignal = true;
        global.checkerActivo = false;
        checkerRunning = false;

        // Matar proceso de Chrome directamente
        try {
            await execAsync('taskkill /F /IM chrome.exe');
        } catch (error) {
            console.error('Error matando Chrome:', error);
        }

        // Limpiar TODAS las variables
        checkerInstance = null;
        checkerProcess = null;
        
        // Reiniciar completamente el estado
        setTimeout(() => {
            global.stopSignal = false;  // Reiniciar señal de parada
            global.checkerActivo = false;
            checkerRunning = false;
            checkerInstance = null;
            checkerProcess = null;
        }, 1000);
        
        res.json({ success: true, message: 'Procesos terminados' });
        
    } catch (error) {
        console.error('Error en parada:', error);
        // Aún así, intentar reiniciar el estado
        global.stopSignal = false;
        global.checkerActivo = false;
        checkerRunning = false;
        checkerInstance = null;
        checkerProcess = null;
        
        res.status(500).json({ 
            success: false, 
            message: 'Error en parada de emergencia' 
        });
    }
});

// BIN Checker
app.post('/api/check-bin', (req, res) => {
    const bin = req.body.bin;
    // Lógica para verificar el BIN
    res.json({ success: true, result: 'Información del BIN' });
});


app.post('/api/generate-cards', (req, res) => {
    try {
        res.json({ success: true });
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la solicitud' });
    }
});

// Middleware para verificar sesión en Socket.IO
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.userId) {
        next();
    } else {
        next();  // Permitir conexión incluso sin sesión
    }
});

// Manejo de conexiones
io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');
    
    socket.on('error', (error) => {
        console.error('Error en socket:', error);
    });

    socket.on('disconnect', (reason) => {
        if (reason === 'transport error') {
            console.log('Error de transporte, no redirigir');
        } else {
            console.log('Cliente desconectado:', reason);
        }
    });
});

// Middleware para verificar sesión en rutas API
const checkSession = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        if (req.path.startsWith('/api/')) {
            res.status(401).json({ success: false, message: 'Sesión expirada' });
        } else {
            res.redirect('/login.html');
        }
    }
};

// Aplicar verificación de sesión excepto en login y registro
app.use((req, res, next) => {
    if (req.path === '/login.html' || 
        req.path === '/api/login' || 
        req.path === '/api/register' ||
        req.path.startsWith('/socket.io/')) {
        next();
    } else {
        checkSession(req, res, next);
    }
});

// Agregar un endpoint para verificar el estado del checker
app.get('/api/checker-status', (req, res) => {
    res.json({
        running: checkerRunning,
        status: checkerRunning ? 'running' : 'stopped'
    });
});

// Iniciar el servidor
server.listen(PORT, async () => {
    logger.success(`Servidor corriendo en http://localhost:${PORT}`);
});

// Configurar timeout más largo para las conexiones
server.setTimeout(120000);

// Modificar la función que procesa las tarjetas para incluir el nuevo gate
app.post('/check', async (req, res) => {
    const { cards, gate, key } = req.body;
    
    try {
        // Validación de key existente...
        
        const GateChecker = gates[gate];
        if (!GateChecker) {
            return res.status(400).json({ error: 'Gate no válido' });
        }
        
        const checker = new GateChecker();
        // ... resto del código de procesamiento
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// Rutas para el panel admin
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adminLogin.html'));
});

app.get('/admin/panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API endpoints para las keys
app.post('/api/admin/validate', async (req, res) => {
    const { adminKey } = req.body;
    const isValid = adminKey === process.env.ADMIN_KEY;
    
    res.json({
        success: isValid,
        message: isValid ? 'Acceso concedido' : 'Clave incorrecta'
    });
});

app.post('/api/admin/generate-keys', async (req, res) => {
    try {
        const { quantity, days } = req.body;
        const keys = [];
        
        for (let i = 0; i < quantity; i++) {
            const key = new Key({
                key: generateUniqueKey(),
                daysValidity: days,
                expiresAt: new Date(Date.now() + (days * 24 * 60 * 60 * 1000))
            });
            
            await key.save();
            keys.push(key);
        }
        
        res.json({ success: true, keys });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/admin/keys', async (req, res) => {
    try {
        const keys = await Key.find().sort('-createdAt');
        res.json({ success: true, keys });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

function generateUniqueKey() {
    return 'KEY-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Ruta para obtener historial de lives
app.get('/api/lives/history', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'No autorizado' 
            });
        }
        
        console.log('Buscando lives para userId:', req.session.userId);
        const lives = await Live.find({ userId: req.session.userId })
            .sort('-createdAt')
            .limit(100);
        
        console.log('Lives encontradas:', lives.length);
        res.json({
            success: true,
            lives: lives
        });
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({
            success: false,
            error: 'Error obteniendo historial'
        });
    }
});

// Ruta para el panel de sistema
app.get('/admin/system', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adminSystem.html'));
});

// API para obtener estado del sistema
app.get('/api/system-status', async (req, res) => {
    try {
        const systemStatus = {
            checkerRunning,
            activeProcesses: checkerInstance ? 1 : 0,
            memory: process.memoryUsage(),
            uptime: process.uptime(),
            activeUsers: await User.countDocuments({ 'subscription.status': 'active' }),
            todayLives: await Live.countDocuments({
                createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
            })
        };
        res.json(systemStatus);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API para acciones de emergencia
app.post('/api/system/kill-all', async (req, res) => {
    try {
        if (checkerInstance && checkerInstance.browser) {
            await checkerInstance.cerrar();
        }
        checkerInstance = null;
        checkerRunning = false;
        global.checkerActivo = false;
        global.stopSignal = true;
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/system/clear-cache', async (req, res) => {
    try {
        await execAsync('del /f /s /q "%temp%\\*"');
        await execAsync('del /f /s /q "C:\\Users\\%username%\\AppData\\Local\\Temp\\*"');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const execAsync = promisify(exec);

// Agregar este endpoint nuevo
app.get('/api/user-info', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false });
        }
        
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({ success: false });
        }
        
        // Enviar el nombre de usuario sin ofuscación
        res.json({ 
            success: true, 
            username: user.username
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false });
    }
});

// Middleware de seguridad
app.use((req, res, next) => {
    // Headers básicos de seguridad
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';");
    
    // Anti CSRF
    const token = req.session.csrf || crypto.randomBytes(32).toString('hex');
    req.session.csrf = token;
    res.locals.csrf = token;

    // Rate limiting
    if (req.ip && req.path.startsWith('/api/')) {
        const requests = rateLimit.get(req.ip) || 0;
        if (requests > 100) { // 100 requests per minute
            return res.status(429).json({ error: 'Too many requests' });
        }
        rateLimit.set(req.ip, requests + 1);
    }

    next();
});

// Protección contra ataques de fuerza bruta
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 30 * 60 * 1000; // 30 minutos

// Ofuscar datos sensibles
const obfuscate = (text) => {
    return Buffer.from(text).toString('base64')
        .split('').reverse().join('');
};

const deobfuscate = (text) => {
    return Buffer.from(
        text.split('').reverse().join(''),
        'base64'
    ).toString();
};

// Validación de origen
const ALLOWED_ORIGINS = ['https://tudominio.com', 'http://localhost:3000'];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!ALLOWED_ORIGINS.includes(origin)) {
        return res.status(403).json({ error: 'Origen no permitido' });
    }
    next();
});

// Sanitización de entradas
app.use((req, res, next) => {
    req.body = mongoSanitize(req.body);
    req.query = mongoSanitize(req.query);
    req.params = mongoSanitize(req.params);
    next();
});

// Middleware de protección básica
app.use((req, res, next) => {
    // Headers básicos de seguridad
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Rate limiting simple para login
    if (req.path === '/api/login') {
        const ip = req.ip;
        const attempts = loginAttempts.get(ip) || { count: 0, timestamp: Date.now() };
        
        if (attempts.count >= 5) { // 5 intentos máximo
            const timeLeft = 15 * 60 * 1000 - (Date.now() - attempts.timestamp);
            if (timeLeft > 0) {
                return res.status(429).json({ 
                    success: false, 
                    message: `Demasiados intentos. Espere ${Math.ceil(timeLeft/60000)} minutos` 
                });
            }
            loginAttempts.delete(ip);
        }
    }
    
    next();
});

// Agregar middleware para ofuscar respuestas sensibles
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
        // Ofuscar datos sensibles en las respuestas
        if (data && data.success && data.cardData) {
            data.cardData = protect.url(JSON.stringify(data.cardData));
        }
        return originalJson.call(this, data);
    };
    next();
});

// Middleware de seguridad avanzada
app.use((req, res, next) => {
    // Verificar headers sospechosos
    const suspiciousHeaders = ['x-forwarded-for', 'forwarded', 'x-real-ip', 'x-originating-ip'];
    for (const header of suspiciousHeaders) {
        if (req.headers[header]) {
            return res.status(403).json({ error: 'Acceso denegado' });
        }
    }

    // Verificar User-Agent
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('curl') || userAgent.includes('wget') || userAgent.includes('python')) {
        return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Verificar método HTTP
    if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    next();
});

// Configuración para producción
if (process.env.NODE_ENV === 'production') {
    // Comprimir respuestas
    app.use(compression());
    
    // Seguridad adicional
    app.use(helmet());
    
    // CORS configurado para tu dominio
    app.use(cors({
        origin: process.env.DOMAIN || '*',
        credentials: true
    }));

    // Forzar HTTPS
    app.use((req, res, next) => {
        if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
            return res.redirect('https://' + req.get('host') + req.url);
        }
        next();
    });
}

// Modificar la conexión MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    sslValidate: true
});