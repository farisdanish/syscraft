FROM php:8.3.11-cli-alpine

# Install PostgreSQL client development libraries and shadow
RUN apk add --no-cache postgresql-dev bash shadow \
    && docker-php-ext-install pdo pdo_pgsql pgsql

# Install Composer 2.7.7
COPY --from=composer:2.7.7 /usr/bin/composer /usr/bin/composer

# Create unprivileged UID/GID 1000:1000
RUN groupadd -g 1000 syscraft && useradd -u 1000 -g syscraft -m -s /bin/bash syscraft

# Pre-create framework cache and tmp directories
RUN mkdir -p /tmp /workspace/storage/framework /workspace/bootstrap/cache \
    && chown -R syscraft:syscraft /workspace /tmp

USER syscraft
WORKDIR /workspace

# Self-check verification
RUN php -v && php -m | grep pdo_pgsql
