import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import { User } from './models/User.js';
import { Key } from './models/Key.js';
import { Live } from './models/Live.js';
import logger from './logger.js';
import { protect } from './utils.js';
import { ElegbaGateChecker, main } from './ElegbaGate.js';
import OshunGateChecker, { runOshunGate } from './OshunGate.js';
import healthRouter from './health.js';

async function initializeApp() {
    try {
        console.log('🚀 Iniciando aplicación...');
        
        // Cargar variables de entorno
        config();
        console.log('✅ Variables de entorno cargadas:', {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            MONGODB_URI: process.env.MONGODB_URI ? 'Configurado' : 'No configurado'
        });

        // Configuración básica
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const PORT = process.env.PORT || 10000;
        const MONGODB_URI = process.env.MONGODB_URI;

        if (!MONGODB_URI) {
            throw new Error('MONGODB_URI no está definido en las variables de entorno');
        }

        // Iniciar Express
        console.log('📦 Iniciando Express...');
        const app = express();
        const server = createServer(app);
        const io = new Server(server);
        global.io = io;
        console.log('✅ Express y Socket.IO iniciados');

        // Configurar middleware
        app.use(express.json());
        app.use(express.static(path.join(__dirname, 'public')));
        app.use(healthRouter);

        // Agregar ruta de prueba
        app.get('/', (req, res) => {
            res.json({ status: 'ok', message: 'Servidor funcionando correctamente' });
        });

        // Conectar a MongoDB
        console.log('🔌 Intentando conectar a MongoDB...');
        console.log('URI de MongoDB:', MONGODB_URI.replace(/:[^:]*@/, ':****@'));
        
        try {
            await mongoose.connect(MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000
            });
            console.log('✅ MongoDB conectado exitosamente');
        } catch (mongoError) {
            console.error('❌ Error conectando a MongoDB:', mongoError);
            throw mongoError;
        }

        // Configurar Socket.IO
        io.on('connection', (socket) => {
            console.log('🔌 Nueva conexión Socket.IO:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('❌ Desconexión Socket.IO:', socket.id);
            });
        });

        // Iniciar servidor
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Servidor corriendo en puerto ${PORT}`);
            console.log(`🌐 URL del servidor: http://localhost:${PORT}`);
        });

        // Mantener el proceso vivo
        process.stdin.resume();

    } catch (error) {
        console.error('❌ Error fatal:', error);
        logger.error('Error fatal en la inicialización:', error);
        
        // Esperar antes de salir para que los logs se envíen
        await new Promise(resolve => setTimeout(resolve, 1000));
        process.exit(1);
    }
}

// Manejar errores no capturados
process.on('uncaughtException', async (error) => {
    console.error('❌ Error no capturado:', error);
    logger.error('Error no capturado:', error);
    
    // Esperar antes de salir para que los logs se envíen
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(1);
});

process.on('unhandledRejection', async (error) => {
    console.error('❌ Promesa rechazada no manejada:', error);
    logger.error('Promesa rechazada no manejada:', error);
    
    // Esperar antes de salir para que los logs se envíen
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(1);
});

// Manejar señales de terminación
process.on('SIGTERM', async () => {
    console.log('🛑 Recibida señal SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 Recibida señal SIGINT');
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(0);
});

// Iniciar la aplicación
console.log('🎬 Iniciando proceso principal...');
initializeApp().catch(async error => {
    console.error('❌ Error en initializeApp:', error);
    await new Promise(resolve => setTimeout(resolve, 1000));
    process.exit(1);
});