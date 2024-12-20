FROM node:20-slim

# Configurar variables de entorno
ENV DEBIAN_FRONTEND=noninteractive \
    CHROME_BIN=/usr/bin/google-chrome \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=512" \
    NPM_CONFIG_LOGLEVEL=warn

# Instalar dependencias del sistema y Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    curl \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/cards /app/logs \
    && chmod -R 777 /app/cards /app/logs

# Configurar el directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm ci --only=production \
    && npm cache clean --force

# Copiar el resto de los archivos
COPY . .

# Crear directorios y archivos necesarios
RUN touch /app/cards/tarjetas.txt \
    /app/cards/live_cvv.txt \
    /app/cards/live_funds.txt \
    /app/cards/live_charged.txt \
    /app/cards/dead.txt

# Verificar la instalación de Chrome
RUN echo "Verificando instalación de Chrome..." \
    && google-chrome --version \
    && echo "Chrome instalado correctamente"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["node", "main.js"]