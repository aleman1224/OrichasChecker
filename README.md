# OrishaChecker

Sistema de verificación de tarjetas con interfaz web y sistema de usuarios.

## Características

- Sistema de usuarios con autenticación
- Dashboard en tiempo real
- Notificaciones por Telegram
- Guardado automático de resultados
- Soporte para múltiples gates
- Sistema de logs detallado

## Requisitos

- Node.js >= 16
- MongoDB
- Google Chrome

## Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/SoulM4chine12/checkerpagina.git
cd checkerpagina
```

2. Instala las dependencias:
```bash
npm install
```

3. Copia el archivo de ejemplo de variables de entorno:
```bash
cp .env.example .env
```

4. Configura las variables en el archivo .env

5. Inicia el servidor:
```bash
npm start
```

## Configuración

Asegúrate de configurar las siguientes variables de entorno en el archivo `.env`:

- MONGO_URI: URL de conexión a MongoDB
- DOMAIN: Dominio de la aplicación
- ADMIN_KEY: Clave de administrador
- TELEGRAM_TOKEN: Token del bot de Telegram
- TELEGRAM_CHAT_ID: ID del chat de Telegram

## Licencia

Este proyecto es privado y su uso está restringido. 