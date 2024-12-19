import { exec } from 'child_process';
import { promisify } from 'util';

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
    }
};

// Constantes ofuscadas
export const CONSTANTS = {
    URLS: {
        PRODUCT: protect.url('https://www.selfedge.com/index.php?route=product/product&product_id=2626'),
        CART: protect.url('https://www.selfedge.com/index.php?route=checkout/cart'),
        CHECKOUT: protect.url('https://www.selfedge.com/index.php?route=checkout/checkout')
    },
    SELECTORS: {
        SIZE: protect.selector('label[for="input-option-value9383"]'),
        ADD_CART: protect.selector('#button-cart'),
        CHECKOUT: protect.selector('#button-guest-checkout'),
        EMAIL: protect.selector('#input-payment-email')
    }
};

// Función para proteger el código
export function obfuscateCode(code) {
    return `
        (function(){
            const _0x${Math.random().toString(36).substr(2,6)}=${code};
            return _0x${Math.random().toString(36).substr(2,6)};
        })();
    `;
}