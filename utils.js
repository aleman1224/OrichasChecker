import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from 'dotenv';

// Cargar variables de entorno
config();

// Convertir exec en una versión que usa promesas
export const execAsync = promisify(exec); 

// Funciones de ofuscación
export const protect = {
    // Ofuscar URLs y endpoints
    url: (url) => {
        return Buffer.from(url).toString('base64').split('').reverse().join('');
    },
    
    // Deofuscar URLs y endpoints
    deobfuscate: (encoded) => {
        return Buffer.from(encoded.split('').reverse().join(''), 'base64').toString();
    },
    
    // Ofuscar selectores
    selector: (selector) => {
        return selector.split('').map(char => 
            String.fromCharCode(char.charCodeAt(0) + 1)
        ).join('');
    },
    
    // Deofuscar selectores
    deobfuscateSelector: (encoded) => {
        return encoded.split('').map(char => 
            String.fromCharCode(char.charCodeAt(0) - 1)
        ).join('');
    },

    // Ofuscar datos sensibles
    sensitiveData: (data) => {
        if (typeof data === 'string') {
            return data.replace(/\d{4}/g, '****');
        }
        return data;
    }
};

// Constantes ofuscadas
export const CONSTANTS = {
    URLS: {
        PRODUCT: protect.url(process.env.PRODUCT_URL || 'https://www.selfedge.com/index.php?route=product/product&product_id=2626'),
        CART: protect.url(process.env.CART_URL || 'https://www.selfedge.com/index.php?route=checkout/cart'),
        CHECKOUT: protect.url(process.env.CHECKOUT_URL || 'https://www.selfedge.com/index.php?route=checkout/checkout')
    },
    SELECTORS: {
        SIZE: protect.selector(process.env.SIZE_SELECTOR || 'label[for="input-option-value9383"]'),
        ADD_CART: protect.selector(process.env.ADD_CART_SELECTOR || '#button-cart'),
        CHECKOUT: protect.selector(process.env.CHECKOUT_SELECTOR || '#button-guest-checkout'),
        EMAIL: protect.selector(process.env.EMAIL_SELECTOR || '#input-payment-email')
    }
};

// Función para proteger el código
export function obfuscateCode(code) {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substr(2, 6);
    return `
        (function(){
            const _0x${timestamp}=${code};
            return _0x${randomStr};
        })();
    `;
}

// Función para validar datos sensibles
export function validateSensitiveData(data) {
    const patterns = {
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        cardNumber: /^\d{16}$/,
        cvv: /^\d{3,4}$/,
        date: /^\d{2}\/\d{2}$/
    };

    const errors = [];
    
    for (const [key, pattern] of Object.entries(patterns)) {
        if (data[key] && !pattern.test(data[key])) {
            errors.push(`Invalid ${key} format`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

// Función para limpiar datos sensibles de los logs
export function sanitizeLogs(logData) {
    if (typeof logData === 'string') {
        return logData
            .replace(/\d{16}/g, '****')
            .replace(/\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b/g, '****@****.***');
    }
    return logData;
}