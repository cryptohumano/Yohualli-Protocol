#!/bin/bash
# Script para configurar HTTPS local con mkcert

set -e

echo "🔐 Configurando HTTPS local para desarrollo..."

# Verificar si mkcert está instalado
if ! command -v mkcert &> /dev/null; then
    echo "❌ mkcert no está instalado."
    echo ""
    echo "Instalación:"
    echo "  Ubuntu/Debian: sudo apt install libnss3-tools && wget -O mkcert https://github.com/FiloSottile/mkcert/releases/latest/download/mkcert-v1.4.4-linux-amd64 && chmod +x mkcert && sudo mv mkcert /usr/local/bin/"
    echo "  macOS: brew install mkcert"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

# Crear directorio para certificados si no existe
mkdir -p .certs

# Instalar CA local si no está instalado
if ! mkcert -CAROOT &> /dev/null; then
    echo "📜 Instalando CA local..."
    mkcert -install
fi

# Todas las IPv4 locales (útil si hay Wi‑Fi + Ethernet; mkcert acepta varias SAN)
LOCAL_IPS=$(hostname -I 2>/dev/null || true)
if [ -z "$LOCAL_IPS" ]; then
    ONE=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')
    LOCAL_IPS="$ONE"
fi
# Primera IP solo para mensajes
LOCAL_IP=$(echo "$LOCAL_IPS" | awk '{print $1}')

echo "🌐 IPs incluidas en el certificado: $LOCAL_IPS"

# Generar certificados
echo "🔑 Generando certificados SSL..."
mkcert -key-file .certs/key.pem -cert-file .certs/cert.pem localhost 127.0.0.1 ::1 $LOCAL_IPS

echo ""
echo "✅ Certificados generados en .certs/"
echo ""
CAROOT=$(mkcert -CAROOT)
echo "📱 Para acceder desde tu móvil (crypto.subtle / wallet):"
echo "   1. Misma Wi‑Fi que el PC."
echo "   2. Abre https://$LOCAL_IP:5173 (o otra IP listada arriba si aplica)."
echo "   3. Chrome/Android: sin instalar la CA verás aviso de certificado → Avanzado → continuar (a veces basta para subtle)."
echo "      Para evitar avisos: instala en el móvil el fichero rootCA.pem de mkcert:"
echo "         $CAROOT/rootCA.pem"
echo "   4. No uses \"localhost\" en el móvil para llegar al PC: localhost es el propio teléfono."
echo ""
echo "🚀 Inicia el servidor con: yarn dev   (HTTPS se activa solo si existen .certs/)"
echo "   Forzar solo HTTP: VITE_DEV_PLAIN_HTTP=1 yarn dev"

