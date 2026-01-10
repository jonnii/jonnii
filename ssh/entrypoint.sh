#!/bin/sh

# Wait for volume to be mounted (Railway mounts volumes after container starts)
echo "Waiting for volume mount..."
for i in $(seq 1 30); do
    if [ -d /app/.ssh ] && touch /app/.ssh/.writetest 2>/dev/null; then
        rm -f /app/.ssh/.writetest
        echo "Volume ready"
        break
    fi
    echo "Waiting for /app/.ssh to be writable... ($i/30)"
    sleep 1
done

# Create directory if it doesn't exist (fallback)
mkdir -p /app/.ssh 2>/dev/null || true

# Generate host key if it doesn't exist
if [ ! -f /app/.ssh/id_ed25519 ]; then
    echo "Generating SSH host key..."
    ssh-keygen -t ed25519 -f /app/.ssh/id_ed25519 -N ""
fi

# Run the server
exec ./jonnii-ssh
