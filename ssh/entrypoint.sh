#!/bin/sh

# Generate host key if it doesn't exist
if [ ! -f /app/.ssh/id_ed25519 ]; then
    echo "Generating SSH host key..."
    ssh-keygen -t ed25519 -f /app/.ssh/id_ed25519 -N ""
fi

# Run the server
exec ./jonnii-ssh
