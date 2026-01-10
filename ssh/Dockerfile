FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install git for fetching dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -o jonnii-ssh .

# Final stage
FROM alpine:latest

WORKDIR /app

# Install openssh for key generation
RUN apk add --no-cache openssh-keygen

# Copy the binary
COPY --from=builder /app/jonnii-ssh .

# Create .ssh directory for host keys
RUN mkdir -p .ssh

# Generate host key on startup
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 22

ENTRYPOINT ["./entrypoint.sh"]
