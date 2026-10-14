---
name: bridge-diagnostics
description: Diagnostic procedures for troubleshooting the loopback Docker bridge, PostgreSQL container connectivity, and process-group cleanup.
---

# Bridge Diagnostics Guide

Use this skill when running or debugging the Tier 3 local bridge connecting the browser to Docker.

## 1. Diagnostic Checklist
1. **Bridge Daemon Status:**
   - Verify daemon is bound to `127.0.0.1:49152`:
     ```bash
     ss -tulpn | grep 49152
     ```
2. **Network Isolation Health:**
   - Confirm internal testnet exists without gateway:
     ```bash
     docker network inspect syscraft-testnet | grep '"Internal": true'
     ```
3. **Database Readiness:**
   - Confirm PostgreSQL 16 container is healthy:
     ```bash
     docker compose exec postgres pg_isready -U syscraft_user
     ```
4. **Process Group Reaping:**
   - If a test was cancelled, confirm no orphaned containers remain:
     ```bash
     docker ps --filter "name=syscraft"
     ```
