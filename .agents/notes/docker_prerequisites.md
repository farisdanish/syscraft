# Docker Prerequisites & Resource Configurations

Tier 3 runtime configurations and container tuning:

## 1. Network Creation
```bash
docker network create --internal syscraft-testnet
```
*Note: The `--internal` flag blocks external routing, preventing any internet access from within containers.*

## 2. Resource Quotas Applied by Bridge
* **CPUs:** 1.0 (`--cpus=1.0`)
* **Memory:** 256MB (`--memory=256m`)
* **Execution Timeout:** 10s hard cutoff with SIGKILL after 12s
* **Max Output Buffer:** 512KB

## 3. Storage Mounts
```text
/workspace               -> :ro (read-only project mount)
/tmp                     -> tmpfs:rw,size=64m
/workspace/storage/framework -> tmpfs:rw,size=32m
/workspace/bootstrap/cache   -> tmpfs:rw,size=16m
```
