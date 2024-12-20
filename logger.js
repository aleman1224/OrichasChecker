import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeLogs } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logsPath = path.join(__dirname, 'logs');
        this.sessionCountFile = path.join(this.logsPath, 'session_count.json');
        
        // Crear directorio de logs si no existe
        this.ensureDirectoryExists(this.logsPath);
        
        // Inicializar o incrementar contador de sesiones
        this.initSessionCounter();
        
        // Configurar rotación de logs
        this.maxLogSize = 5 * 1024 * 1024; // 5MB
        this.maxLogFiles = 5;
        
        // Iniciar limpieza periódica
        this.startPeriodicCleanup();
    }

    ensureDirectoryExists(dir) {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
            } catch (error) {
                console.error(`Error creando directorio ${dir}:`, error);
                throw error;
            }
        }
    }

    initSessionCounter() {
        try {
            let sessionData = { count: 0, lastCleanup: new Date().toISOString() };
            
            if (fs.existsSync(this.sessionCountFile)) {
                sessionData = JSON.parse(fs.readFileSync(this.sessionCountFile, 'utf8'));
                sessionData.count++;
            } else {
                sessionData.count = 1;
            }

            fs.writeFileSync(this.sessionCountFile, JSON.stringify(sessionData, null, 2));
        } catch (error) {
            console.error('Error manejando contador de sesiones:', error);
        }
    }

    startPeriodicCleanup() {
        setInterval(() => {
            try {
                this.rotateLogsIfNeeded();
                this.cleanOldLogs();
            } catch (error) {
                console.error('Error en limpieza periódica:', error);
            }
        }, 1000 * 60 * 60); // Cada hora
    }

    rotateLogsIfNeeded() {
        const logFiles = ['checker.txt', 'error.txt', 'system.txt'];
        
        logFiles.forEach(file => {
            const logFile = path.join(this.logsPath, file);
            
            try {
                if (fs.existsSync(logFile)) {
                    const stats = fs.statSync(logFile);
                    
                    if (stats.size > this.maxLogSize) {
                        // Rotar archivos existentes
                        for (let i = this.maxLogFiles - 1; i > 0; i--) {
                            const oldFile = path.join(this.logsPath, `${file}.${i}`);
                            const newFile = path.join(this.logsPath, `${file}.${i + 1}`);
                            
                            if (fs.existsSync(oldFile)) {
                                fs.renameSync(oldFile, newFile);
                            }
                        }
                        
                        // Mover el archivo actual
                        fs.renameSync(logFile, path.join(this.logsPath, `${file}.1`));
                        
                        // Crear nuevo archivo
                        fs.writeFileSync(logFile, '');
                    }
                }
            } catch (error) {
                console.error(`Error rotando archivo ${file}:`, error);
            }
        });
    }

    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logsPath);
            const now = new Date();
            
            files.forEach(file => {
                const filePath = path.join(this.logsPath, file);
                const stats = fs.statSync(filePath);
                const fileAge = (now - stats.mtime) / (1000 * 60 * 60 * 24); // días
                
                if (fileAge > 7 && file.match(/\.\d+$/)) { // Archivos rotados más viejos que 7 días
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('Error limpiando logs antiguos:', error);
        }
    }

    formatLog(message) {
        const date = new Date();
        const timestamp = date.toLocaleString('es-ES', { 
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return `[${timestamp}] ${sanitizeLogs(message)}\n`;
    }

    writeLog(type, message) {
        try {
            const logFile = path.join(this.logsPath, `${type}.txt`);
            fs.appendFileSync(logFile, this.formatLog(message));
        } catch (error) {
            console.error(`Error escribiendo en ${type}.txt:`, error);
        }
    }

    checker(message) {
        if (message.includes('LIVE') || message.includes('DEAD')) {
            this.writeLog('checker', message.trim());
        }
    }

    error(message, error = '') {
        const errorMessage = error ? `${message} ${error.stack || error}` : message;
        this.writeLog('error', errorMessage);
    }

    system(message) {
        this.writeLog('system', message);
    }

    success(message) {
        this.writeLog('system', `SUCCESS: ${message}`);
        console.log(`✅ ${message}`);
    }

    clearLogs(type) {
        try {
            const logFile = path.join(this.logsPath, `${type}.txt`);
            if (fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, '');
            }
        } catch (error) {
            this.error(`Error al limpiar logs de ${type}:`, error);
        }
    }

    getLogs(type) {
        try {
            const logFile = path.join(this.logsPath, `${type}.txt`);
            if (fs.existsSync(logFile)) {
                const content = fs.readFileSync(logFile, 'utf8');
                return content.split('\n').filter(line => line.trim());
            }
            return [];
        } catch (error) {
            this.error(`Error al leer logs de ${type}:`, error);
            return [];
        }
    }

    getSessionCount() {
        try {
            if (fs.existsSync(this.sessionCountFile)) {
                const sessionData = JSON.parse(fs.readFileSync(this.sessionCountFile, 'utf8'));
                return sessionData.count;
            }
            return 0;
        } catch (error) {
            this.error('Error al leer contador de sesiones:', error);
            return 0;
        }
    }

    checkLogSystem() {
        try {
            const files = ['checker.txt', 'error.txt', 'system.txt'];
            const status = {
                sessionCount: this.getSessionCount(),
                files: {}
            };

            files.forEach(file => {
                const filePath = path.join(this.logsPath, file);
                status.files[file] = {
                    exists: fs.existsSync(filePath),
                    writable: false,
                    size: 0
                };

                if (status.files[file].exists) {
                    try {
                        fs.accessSync(filePath, fs.constants.W_OK);
                        status.files[file].writable = true;
                        const stats = fs.statSync(filePath);
                        status.files[file].size = stats.size;
                    } catch (e) {
                        // El archivo existe pero no es escribible
                    }
                }
            });

            return status;
        } catch (error) {
            this.error('Error al verificar sistema de logs:', error);
            return null;
        }
    }
}

export default new Logger();
