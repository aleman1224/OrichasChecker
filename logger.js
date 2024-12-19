import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
    constructor() {
        this.logsPath = path.join(__dirname, 'logs');
        this.sessionCountFile = path.join(this.logsPath, 'session_count.json');
        
        // Crear directorio de logs si no existe
        if (!fs.existsSync(this.logsPath)) {
            fs.mkdirSync(this.logsPath);
        }

        // Inicializar o incrementar contador de sesiones
        this.initSessionCounter();
    }

    initSessionCounter() {
        try {
            let sessionData = { count: 0 };
            
            if (fs.existsSync(this.sessionCountFile)) {
                sessionData = JSON.parse(fs.readFileSync(this.sessionCountFile, 'utf8'));
                sessionData.count++;
            } else {
                sessionData.count = 1;
            }

            // Si alcanzamos 2 sesiones, limpiamos logs y reiniciamos contador
            if (sessionData.count >= 2) {
                this.clearAllLogs();
                sessionData.count = 0;
                this.system('Logs limpiados automáticamente después de 2 sesiones');
            }

            fs.writeFileSync(this.sessionCountFile, JSON.stringify(sessionData));
        } catch (error) {
            console.error('Error manejando contador de sesiones:', error);
        }
    }

    clearAllLogs() {
        const logFiles = ['checker.txt', 'error.txt', 'system.txt'];
        logFiles.forEach(file => {
            try {
                const logFile = path.join(this.logsPath, file);
                if (fs.existsSync(logFile)) {
                    fs.writeFileSync(logFile, '');
                }
            } catch (error) {
                console.error(`Error limpiando ${file}:`, error);
            }
        });
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
        return `[${timestamp}] ${message}\n`;
    }

    checker(message) {
        try {
            const logFile = path.join(this.logsPath, 'checker.txt');
            if (message.includes('LIVE') || message.includes('DEAD')) {
                fs.appendFileSync(logFile, this.formatLog(message.trim()));
            }
        } catch (error) {
            this.error('Error al escribir log del checker:', error);
        }
    }

    error(message, error = '') {
        try {
            const logFile = path.join(this.logsPath, 'error.txt');
            const errorMessage = error ? `${message} ${error.stack || error}` : message;
            fs.appendFileSync(logFile, this.formatLog(errorMessage));
        } catch (err) {
            console.error('Error crítico al escribir log de error:', err);
        }
    }

    system(message) {
        try {
            const logFile = path.join(this.logsPath, 'system.txt');
            fs.appendFileSync(logFile, this.formatLog(message));
        } catch (error) {
            this.error('Error al escribir log del sistema:', error);
        }
    }

    success(message) {
        try {
            const logFile = path.join(this.logsPath, 'system.txt');
            fs.appendFileSync(logFile, this.formatLog(`SUCCESS: ${message}`));
            console.log(`✅ ${message}`);
        } catch (error) {
            this.error('Error al escribir log de éxito:', error);
        }
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
