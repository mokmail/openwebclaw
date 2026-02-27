# OpenWebClaw - Docker Setup

This guide explains how to run OpenWebClaw inside Docker.

## 📋 Overview

The Docker Compose setup includes:

- **OpenWebClaw** - The React PWA served via nginx
- **(Optional) PostgreSQL** - Production database (commented out, uses SQLite by default)

## 🚀 Quick Start

```bash
# 1. Setup environment
make setup

# 2. Start services
make up
```

## 📱 Accessing the Service

After starting:

| Service | URL | Description |
|---------|-----|-------------|
| OpenWebClaw | http://localhost:5173 | The main PWA app |

## 🔧 Configuration

### Environment Variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | 5173 | Port for OpenWebClaw |
| `OLLAMA_URL` | (empty) | Ollama API URL for local LLM |
| `OPENWEBUI_URL` | (empty) | OpenWebUI URL for remote AI |

### Production Setup

For production, uncomment the PostgreSQL service in `docker-compose.yml`:

```yaml
postgres:
  image: postgres:16-alpine
  # ... rest of config
```

## 📁 Data Persistence

Data is stored in Docker volumes:

- `postgres-data` - PostgreSQL database (if enabled)

## 🔒 Security Notes

1. **Change default passwords** in `.env` before deploying
2. **Configure reverse proxy** (nginx/traefik) with SSL for external access

## 🐛 Troubleshooting

### Config file does not exist

This project no longer uses Synapse; ignore previous instructions.

### Check service status
```bash
make status
# or
docker compose ps
docker compose logs openwebclaw
```

### Reset everything
```bash
# Stop and remove containers
docker compose down

# Remove volumes (WARNING: deletes all data!)
make clean
# or
docker compose down -v

# Rebuild and restart
docker compose up -d --build
```

## 📚 Make Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all commands |
| `make setup` | Copy .env template |
| `make build` | Build Docker images |
| `make up` | Start all services |
| `make down` | Stop all services |
| `make restart` | Restart services |
| `make logs` | View all logs |
| `make status` | Check health |
| `make clean` | Remove everything |

## 🔗 Useful Links

- [OpenWebClaw GitHub](https://github.com/...)
