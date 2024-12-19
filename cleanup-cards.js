import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function cleanupCards() {
    const cardsPath = path.join(__dirname, 'cards');
    const files = [
        'tarjetas.txt',
        'live_cvv.txt',
        'live_funds.txt',
        'live_charged.txt',
        'dead.txt'
    ];

    try {
        // Crear backup antes de limpiar
        const backupDir = path.join(cardsPath, 'backup');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        for (const file of files) {
            const filePath = path.join(cardsPath, file);
            if (fs.existsSync(filePath)) {
                // Crear backup
                const backupPath = path.join(backupDir, `${file}.${timestamp}.bak`);
                fs.copyFileSync(filePath, backupPath);
                
                // Limpiar archivo
                fs.writeFileSync(filePath, '');
                
                logger.success(`Archivo ${file} limpiado y respaldado`);
            }
        }

        // Mantener solo los últimos 5 backups
        const backups = fs.readdirSync(backupDir);
        if (backups.length > 5) {
            backups
                .sort()
                .slice(0, -5)
                .forEach(backup => {
                    fs.unlinkSync(path.join(backupDir, backup));
                });
        }

        logger.success('Limpieza de archivos completada');
    } catch (error) {
        logger.error('Error en la limpieza de archivos:', error);
    }
}

// Solo ejecutar si se llama directamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    cleanupCards();
} 