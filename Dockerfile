FROM node:20-slim

# Instalar dependencias necesarias
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    libxss1 libxtst6 libxrandr2 libasound2 libatk1.0-0 libatk-bridge2.0-0 libgtk-3-0 \
    libgbm1 libnss3 libxss1 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxtst6 \
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

# Variables de entorno para Chrome
ENV CHROME_BIN=/usr/bin/google-chrome \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Exponer el puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["npm", "start"]