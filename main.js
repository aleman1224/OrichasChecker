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

console.log('🚀 Iniciando aplicación...');

try {
    console.log('✅ Módulos importados correctamente');

    // Configuración básica
    config();
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const PORT = process.env.PORT || 10000;

    console.log('5️⃣ Iniciando Express...');
    const app = express();
    const server = createServer(app);
    console.log('✅ Express iniciado');

    console.log('6️⃣ Conectando a MongoDB...');
    await mongoose.connect('mongodb+srv://alemancheck:ALEMAN1988@cluster0.er1x4.mongodb.net/alemanChecker?retryWrites=true&w=majority&appName=Cluster0', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('✅ MongoDB conectado');

    console.log('7️⃣ Iniciando servidor...');
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    });

} catch (error) {
    console.error('❌ Error fatal:', error);
    process.exit(1);
}