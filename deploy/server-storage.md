# Cloud/server Pi storage

The cloud/server Pi uses a separate Samsung SSD for catalogue data and native
AAC-LC M4A assets. The preparation script is deliberately tied to the verified drive
identity below; it does not use `/dev/sda` as a stable name.

At the time this procedure was prepared, the drive resolved to `/dev/sda` and
had an exFAT partition 2 containing only `System Volume Information`.

## One-time preparation

Copy `deploy/prepare-server-storage.sh` to the server Pi, for example:

```bash
scp deploy/prepare-server-storage.sh "$PI_HOST:~/prepare-server-storage.sh"
```

Review the target and then run the script from an interactive SSH session:

```bash
ssh "$PI_HOST"
sudo bash ~/prepare-server-storage.sh
```

The script will only continue when the user types the requested confirmation
containing serial `S626NF0R452939V`. It verifies the by-id path, model
`Samsung SSD 870 EVO 1TB`, serial, and the running root disk before it can
erase anything. The authorized target is:

```text
/dev/disk/by-id/ata-Samsung_SSD_870_EVO_1TB_S626NF0R452939V
serial: S626NF0R452939V
```

It creates a GPT with one ext4 partition labeled `keystack-data`, reserves 0%
of blocks, and mounts it at `/srv/keystack-data`. The UUID entry in
`/etc/fstab` uses:

```text
defaults,noatime,nofail,x-systemd.device-timeout=10s
```

Before editing `/etc/fstab`, the script saves a timestamped
`/etc/fstab.keystack-data.*` backup. It creates `sqlite`, `audio`, and `backups`
with owner `emilianopolanco5` (`1000:1000`) and mode `0750`, then performs a
write/delete smoke test as that user. Re-running the script fails when the
mount or fstab entry already exists or when the target already has the
`keystack-data` filesystem label; it will not silently format an existing
setup.

This step creates directories only. There is no cloud service yet, so it does
not create a SQLite database or schema.

## Service prerequisite

The future cloud service must require the mount before it starts, so a missing
SSD cannot make SQLite or assets fall back to the Raspberry Pi SD card. Add
this to the service unit that starts the cloud service:

```ini
[Unit]
RequiresMountsFor=/srv/keystack-data
```

The service should use `/srv/keystack-data/sqlite`, `/srv/keystack-data/audio`,
and `/srv/keystack-data/backups` as its configured data paths after the cloud
service and schema migration are introduced.
