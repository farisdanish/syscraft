# Security & Threat Model

Rules governing the execution boundary between the browser and local Docker environments:

---

## 1. Loopback Bridge Security
1. **Binding Address:** `127.0.0.1:49152` only. Never bind to `0.0.0.0`.
2. **Allowed Origin:** Configurable via `ALLOWED_ORIGIN`, defaulting strictly to `http://localhost:5173`. Never accept wildcards, `file://`, or null origins.
3. **One-Time Capability Tokens:** The browser studio issues a random cryptographic token per drill run. The bridge invalidates the token upon use.
4. **Command Allowlist (`command_manifest.v1.json`):**
   - The bridge parses structured executable-and-argument arrays only.
   - Arbitrary shell strings and command chaining (`&&`, `|`, `;`) are prohibited.
5. **Process Group Reaping:**
   - The bridge launches child processes in distinct POSIX process groups.
   - On client cancellation or timeout, `kill -2 -<pgid>` cleanly reaps the Docker process tree without leaving orphaned containers or volumes.

---

## 2. Docker Container Isolation
1. **Isolated Internal Network:** Containers run on `syscraft-testnet --internal` with zero external egress.
2. **No Published Database Ports:** PostgreSQL container port 5432 is accessible only to `syscraft-runner` via internal DNS.
3. **Unprivileged User:** Run as `UID:GID 1000:1000`. Never run container commands as `root`.
4. **Read-Only Source:** Project workspace is mounted `:ro`. Writable directories (`/tmp`, `storage/framework`, `bootstrap/cache`) are backed by isolated `tmpfs` mounts.
5. **Dropped Linux Capabilities:** Always run with `--cap-drop=ALL`.
6. **No Docker Socket:** Never mount `/var/run/docker.sock` inside the runner container.
