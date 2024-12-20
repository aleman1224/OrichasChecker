import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a MongoDB
        const mongoStatus = mongoose.connection.readyState === 1;

        // Verificar estado general de la aplicación
        const status = {
            timestamp: new Date().toISOString(),
            service: 'OrishaChecker',
            mongodb: mongoStatus ? 'connected' : 'disconnected',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV
        };

        if (mongoStatus) {
            res.status(200).json({ status: 'healthy', details: status });
        } else {
            res.status(503).json({ status: 'unhealthy', details: status });
        }
    } catch (error) {
        res.status(500).json({ 
            status: 'error', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router; 