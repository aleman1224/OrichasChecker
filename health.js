import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/health', async (req, res) => {
    try {
        // Verificar conexión a MongoDB
        const isMongoConnected = mongoose.connection.readyState === 1;

        if (!isMongoConnected) {
            return res.status(503).json({
                status: 'error',
                message: 'MongoDB no está conectado',
                details: {
                    mongodb: false
                }
            });
        }

        // Todo está bien
        return res.status(200).json({
            status: 'ok',
            message: 'El servicio está funcionando correctamente',
            details: {
                mongodb: true,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error en health check:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Error interno del servidor',
            details: {
                error: error.message
            }
        });
    }
});

export default router; 