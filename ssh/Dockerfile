FROM golang:1.25-alpine3.21 AS builder

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o jonnii-ssh .

# Final stage
FROM alpine:3.21

WORKDIR /app

# Install openssh for key generation and ca-certificates for HTTPS
RUN apk add --no-cache openssh-keygen ca-certificates

# Create non-root user
RUN adduser -D -u 1000 appuser

# Create .ssh directory for host keys with proper permissions
# NOTE: For persistent host keys, mount a volume to /app/.ssh
# e.g., docker run -v ssh-keys:/app/.ssh ...
RUN mkdir -p .ssh && chown appuser:appuser .ssh

# Copy the binary
COPY --from=builder /app/jonnii-ssh .

# Copy entrypoint script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Change ownership to non-root user
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Document the SSH port
EXPOSE 22

# Health check - verify process is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pgrep jonnii-ssh || exit 1

ENTRYPOINT ["./entrypoint.sh"]
