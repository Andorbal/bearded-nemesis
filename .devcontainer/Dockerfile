FROM node:24

ARG TZ
ENV TZ="$TZ"

ARG CLAUDE_CODE_VERSION=latest

# Install basic development tools and iptables/ipset
RUN apt-get update && apt-get install -y --no-install-recommends \
  less \
  git \
  procps \
  sudo \
  fzf \
  zsh \
  man-db \
  unzip \
  gnupg2 \
  gh \
  iptables \
  ipset \
  iproute2 \
  dnsutils \
  aggregate \
  jq \
  nano \
  vim \
  curl \
  wget \
  ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install PostgreSQL client (psql)
RUN apt-get update && apt-get install -y --no-install-recommends \
  postgresql-client \
  tesseract-ocr \
  python3-pip \
  python3.11-venv \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Pre-download PaddleOCR models (cached early in build)
# Using PP-OCRv3 models which have more reliable CDN availability
# Models are downloaded from Baidu CDN with retries and timeout
RUN mkdir -p /opt/paddleocr-models && \
  cd /opt/paddleocr-models && \
  for url in \
    "https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_det_infer.tar" \
    "https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_rec_infer.tar" \
    "https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar"; do \
    echo "Downloading: $url" && \
    wget --tries=3 --timeout=60 --retry-connrefused -q "$url" || \
    (echo "Failed to download $url" && exit 1); \
  done && \
  for f in *.tar; do tar -xf "$f" && rm -f "$f"; done && \
  chmod -R 755 /opt/paddleocr-models

# Environment variables for PaddleOCR model paths
ENV PADDLEOCR_DET_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_det_infer
ENV PADDLEOCR_REC_MODEL_DIR=/opt/paddleocr-models/en_PP-OCRv3_rec_infer
ENV PADDLEOCR_CLS_MODEL_DIR=/opt/paddleocr-models/ch_ppocr_mobile_v2.0_cls_infer

# Install glab (GitLab CLI)
ARG GLAB_VERSION=1.51.0
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://gitlab.com/gitlab-org/cli/-/releases/v${GLAB_VERSION}/downloads/glab_${GLAB_VERSION}_linux_${ARCH}.deb" && \
  dpkg -i "glab_${GLAB_VERSION}_linux_${ARCH}.deb" && \
  rm "glab_${GLAB_VERSION}_linux_${ARCH}.deb"

# Install additional useful tools for development
RUN apt-get update && apt-get install -y --no-install-recommends \
  htop \
  tree \
  net-tools \
  iputils-ping \
  telnet \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Ensure default node user has access to /usr/local/share
RUN mkdir -p /usr/local/share/npm-global && \
  chown -R node:node /usr/local/share

ARG USERNAME=node

# Persist bash history.
RUN SNIPPET="export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  && mkdir /commandhistory \
  && touch /commandhistory/.bash_history \
  && chown -R $USERNAME /commandhistory

# Set `DEVCONTAINER` environment variable to help with orientation
ENV DEVCONTAINER=true

# Create workspace and config directories and set permissions
RUN mkdir -p /workspace /home/node/.claude && \
  chown -R node:node /workspace /home/node/.claude

WORKDIR /workspace

ARG GIT_DELTA_VERSION=0.18.2
RUN ARCH=$(dpkg --print-architecture) && \
  wget "https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  sudo dpkg -i "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb" && \
  rm "git-delta_${GIT_DELTA_VERSION}_${ARCH}.deb"

# Install pnpm (using Corepack which comes with Node 24)
# Must be done as root before switching to node user
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set up non-root user
USER node

# Install global packages
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# Set the default shell to zsh rather than sh
ENV SHELL=/bin/zsh

# Set the default editor and visual
ENV EDITOR=nano
ENV VISUAL=nano

# Default powerline10k theme
ARG ZSH_IN_DOCKER_VERSION=1.2.0
RUN sh -c "$(wget -O- https://github.com/deluan/zsh-in-docker/releases/download/v${ZSH_IN_DOCKER_VERSION}/zsh-in-docker.sh)" -- \
  -p git \
  -p fzf \
  -a "source /usr/share/doc/fzf/examples/key-bindings.zsh" \
  -a "source /usr/share/doc/fzf/examples/completion.zsh" \
  -a "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
  -x

# Install Claude Code
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}


# Copy and set up firewall scripts
COPY init-firewall.sh /usr/local/bin/
USER root
RUN chmod +x /usr/local/bin/init-firewall.sh && \
  echo "node ALL=(root) NOPASSWD: /usr/local/bin/init-firewall.sh" > /etc/sudoers.d/node-firewall && \
  chmod 0440 /etc/sudoers.d/node-firewall
USER node
