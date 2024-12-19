FROM node:20-slim

# Instalar dependencias necesarias
RUN apt-get update \
    && apt-get install -y \
    firefox-esr \
    xvfb \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libcups2 \
    libxss1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/cards

# Configurar el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto de los archivos
COPY . .

# Crear directorios necesarios
RUN mkdir -p /app/cards && \
    touch /app/cards/tarjetas.txt && \
    touch /app/cards/live_cvv.txt && \
    touch /app/cards/live_funds.txt && \
    touch /app/cards/live_charged.txt && \
    touch /app/cards/dead.txt

# Establecer permisos
RUN chmod -R 777 /app/cards

# Variables de entorno para Firefox
ENV DISPLAY=:99 \
    PUPPETEER_PRODUCT=firefox

# Exponer el puerto
EXPOSE 3000

# Script de inicio que configura Xvfb y luego inicia la aplicación
CMD Xvfb :99 -screen 0 1024x768x16 & npm start 