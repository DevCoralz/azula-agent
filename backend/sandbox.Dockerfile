# Sandbox image used when SANDBOX_MODE=docker.
# Every agent command runs in a throwaway container built from this image
# with the workspace bind-mounted at /workspace.
FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl wget ca-certificates jq unzip zip tar \
      build-essential python3 python3-pip python3-venv \
      golang-go ruby-full php-cli composer \
      ripgrep nmap whois dnsutils iputils-ping netcat-openbsd \
      nikto sqlmap hydra john \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm yarn tsx typescript

RUN useradd -m -u 10001 agent
USER agent
WORKDIR /workspace
CMD ["bash"]
