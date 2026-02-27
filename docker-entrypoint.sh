#!/bin/sh
# ---------------------------------------------------------------------------
# OpenWebClaw - Docker Entrypoint
# ---------------------------------------------------------------------------
# Substitutes environment variables into config files and starts nginx
# ---------------------------------------------------------------------------

set -e

echo "🔧 OpenWebClaw Docker Entrypoint"
echo "======================================"

# Environment variables with defaults
# On Linux, host.docker.internal is not available; use localhost if services are on the host,
# or leave empty if those services are not needed
export OLLAMA_URL="${VITE_OLLAMA_URL:-}"
export OPENWEBUI_URL="${VITE_OPENWEBUI_URL:-}"

echo "📋 Configuration:"
echo "   - Ollama URL: $OLLAMA_URL"
echo "   - OpenWebUI URL: $OPENWEBUI_URL"

# Substitute environment variables in nginx config
echo "🔧 Configuring nginx..."
envsubst '${OLLAMA_URL} ${OPENWEBUI_URL}' < /etc/nginx/conf.d/default.conf > /tmp/nginx.conf.tmp
mv /tmp/nginx.conf.tmp /etc/nginx/conf.d/default.conf

# Create runtime config for the PWA
# This allows the app to read runtime configuration
echo "📝 Creating runtime config..."
cat > /usr/share/nginx/html/config.json << EOF
{
  "ollamaUrl": "$OLLAMA_URL",
  "openwebuiUrl": "$OPENWEBUI_URL",
  "version": "${APP_VERSION:-0.1.0}",
  "buildTime": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF

echo "✅ Configuration complete!"
echo ""
echo "🚀 Starting nginx..."
echo "======================================"

# Execute the main command
exec "$@"
