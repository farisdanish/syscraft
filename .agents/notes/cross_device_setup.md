# Cross-Device Setup Notes

Instructions for syncing and executing **SysCraft** across Linux, macOS, and Windows (WSL2):

## 1. Prerequisites Across Environments
* **Node.js:** v20.x or v22.x LTS
* **Package Manager:** `npm` (with locked `package-lock.json`)
* **Docker Engine:** Docker Compose v2.20+ (for Tier 3 exercises)

## 2. Platform Specifics
### Linux (Debian / Ubuntu / Fedora)
- Ensure your local user is in the `docker` group: `sudo usermod -aG docker $USER`
- Run `npm run dev` to start the studio on `http://localhost:5173`.

### macOS (Apple Silicon / Intel)
- Enable VirtioFS in Docker Desktop settings for optimal bind mount speed.
- Native loopback `127.0.0.1:49152` works out of the box with the bridge daemon.

### Windows (WSL2)
- Execute all commands inside the WSL2 Ubuntu terminal rather than PowerShell/CMD.
- Clone the repository within the WSL2 filesystem (`/home/<user>/...`), not the mounted `/mnt/c/` drive, to avoid file notification latency with Vite.
