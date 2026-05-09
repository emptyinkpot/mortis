# Mortis Builder runtime image.
#
# This image is used only by Builder actions when MORTIS_BUILDER_CONTAINER_IMAGE
# is set. Keep the backend image focused on serving API traffic; put repository
# execution tools here.

FROM golang:1.26-alpine

ENV PATH=/usr/local/go/bin:/go/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV npm_config_registry=https://registry.npmmirror.com
ENV GOPROXY=https://goproxy.cn,direct
ENV GOSUMDB=sum.golang.google.cn

RUN sed -i "s/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g" /etc/apk/repositories

RUN apk add --no-cache \
    bash \
    ca-certificates \
    curl \
    git \
    make \
    nodejs \
    npm \
    openssh-client \
    tzdata \
    && ln -sf /usr/local/go/bin/go /usr/local/bin/go \
    && ln -sf /usr/local/go/bin/gofmt /usr/local/bin/gofmt \
    && npm install -g pnpm@10.28.2 @openai/codex@0.128.0 \
    && npm cache clean --force

WORKDIR /workspace/repo

CMD ["sh", "-lc", "codex --version && go version && pnpm --version"]
