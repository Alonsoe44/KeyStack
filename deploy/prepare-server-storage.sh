#!/usr/bin/env bash
# Prepare the separately attached SSD used by the KeyStack cloud/server Pi.
#
# This script is intentionally specific to the drive identified below.  It is
# destructive: after the interactive confirmation it replaces the drive's
# partition table and filesystem.  It does not create an application database.

set -euo pipefail

# A sudo shell on Raspberry Pi OS normally has these directories in PATH, but
# setting it explicitly keeps commands such as sfdisk and mkfs available when
# sudo has a restricted secure_path.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

readonly TARGET_BY_ID="/dev/disk/by-id/ata-Samsung_SSD_870_EVO_1TB_S626NF0R452939V"
readonly EXPECTED_MODEL="Samsung SSD 870 EVO 1TB"
readonly EXPECTED_SERIAL="S626NF0R452939V"
readonly FILESYSTEM_LABEL="keystack-data"
readonly MOUNT_POINT="/srv/keystack-data"
readonly OWNER_NAME="emilianopolanco5"
readonly OWNER_UID="1000"
readonly OWNER_GID="1000"
readonly FSTAB_OPTIONS="defaults,noatime,nofail,x-systemd.device-timeout=10s"
readonly RUNTIME_MOUNT_OPTIONS="defaults,noatime"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_commands() {
  local command_name
  for command_name in "$@"; do
    command -v "$command_name" >/dev/null 2>&1 || die "required command not found: $command_name"
  done
}

trim() {
  sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'
}

get_target_partitions() {
  lsblk -lnpo NAME,TYPE "$TARGET_DEVICE" | awk '$2 == "part" { print $1 }'
}

fstab_entries_for_mountpoint() {
  awk -v mount_point="$MOUNT_POINT" '
    /^[[:space:]]*#/ { next }
    NF >= 2 && $2 == mount_point { print NR ":" $0 }
  ' /etc/fstab
}

fstab_has_uuid() {
  local uuid="$1"
  awk -v source="UUID=$uuid" '
    /^[[:space:]]*#/ { next }
    NF >= 1 && $1 == source { found = 1 }
    END { exit(found ? 0 : 1) }
  ' /etc/fstab
}

verify_target_identity() {
  local target_device="$1"
  local device_type actual_serial actual_model

  [[ -b "$target_device" ]] || die "target is not a block device: $target_device"

  device_type="$(lsblk -dnro TYPE "$target_device" | trim)"
  [[ "$device_type" == "disk" ]] || die "refusing non-disk target $target_device (type: $device_type)"

  actual_serial="$(lsblk -dnro SERIAL "$target_device" | tr -d '[:space:]')"
  [[ -n "$actual_serial" ]] || die "could not read the target disk serial"
  [[ "$actual_serial" == "$EXPECTED_SERIAL" ]] || die \
    "refusing target with serial '$actual_serial'; expected '$EXPECTED_SERIAL'"

  # Do not use lsblk's --raw output for MODEL: raw mode escapes the spaces in
  # this model as literal backslash sequences.
  actual_model="$(lsblk -dno MODEL "$target_device" | trim)"
  [[ "$actual_model" == "$EXPECTED_MODEL" ]] || die \
    "refusing target with model '$actual_model'; expected '$EXPECTED_MODEL'"
}

find_root_disk() {
  local root_source root_node parent device_type attempt

  root_source="$(findmnt -nro SOURCE / 2>/dev/null || true)"
  if [[ "$root_source" == /dev/* ]]; then
    root_node="$root_source"
  else
    # This also handles a source reported as UUID=... or a layered source
    # where findmnt cannot provide a direct /dev path.
    root_node="$(lsblk -nrpo NAME,PKNAME,MOUNTPOINT 2>/dev/null | awk '$3 == "/" { print $1; exit }' || true)"
  fi
  [[ -n "$root_node" ]] || die "could not identify the mounted root device; refusing to format anything"

  for attempt in {1..8}; do
    root_node="$(readlink -f -- "$root_node" 2>/dev/null || printf '%s' "$root_node")"
    device_type="$(lsblk -dnro TYPE "$root_node" 2>/dev/null | trim || true)"
    if [[ "$device_type" == "disk" ]]; then
      printf '%s\n' "$root_node"
      return 0
    fi

    parent="$(lsblk -dnro PKNAME "$root_node" 2>/dev/null | tr -d '[:space:]' || true)"
    [[ -n "$parent" ]] || die "could not walk root device ancestry from $root_node; refusing to format anything"
    root_node="/dev/$parent"
  done

  die "could not resolve the root device to a whole disk; refusing to format anything"
}

unmount_target_partitions() {
  local part mount_target swap_device remaining_mounts
  local -a partitions=()

  mapfile -t partitions < <(get_target_partitions)
  for part in "${partitions[@]}"; do
    while IFS= read -r mount_target; do
      [[ -n "$mount_target" ]] || continue
      printf 'Unmounting %s from %s\n' "$part" "$mount_target"
      umount -- "$mount_target" || die "could not unmount $mount_target"
    done < <(findmnt -rn -S "$part" -o TARGET 2>/dev/null || true)

    while IFS= read -r swap_device; do
      swap_device="$(printf '%s' "$swap_device" | trim)"
      [[ -n "$swap_device" && "$swap_device" == "$part" ]] || continue
      printf 'Disabling swap on %s\n' "$part"
      swapoff -- "$part" || die "could not disable swap on $part"
    done < <(swapon --show=NAME --noheadings 2>/dev/null || true)
  done

  for part in "${partitions[@]}"; do
    remaining_mounts="$(findmnt -rn -S "$part" -o TARGET 2>/dev/null || true)"
    [[ -z "$remaining_mounts" ]] || die "partition is still mounted after unmount attempt: $part"
  done
}

verify_mount() {
  local mounted_source mounted_real mounted_type mounted_uuid

  mountpoint -q -- "$MOUNT_POINT" || die "mountpoint is not mounted: $MOUNT_POINT"
  mounted_source="$(findmnt -nro SOURCE --target "$MOUNT_POINT" 2>/dev/null || true)"
  [[ -n "$mounted_source" ]] || die "could not identify the mounted source for $MOUNT_POINT"
  mounted_real="$(readlink -f -- "$mounted_source")"
  [[ "$mounted_real" == "$NEW_PARTITION_REAL" ]] || die \
    "mountpoint source is $mounted_real, expected $NEW_PARTITION_REAL"
  mounted_type="$(findmnt -nro FSTYPE --target "$MOUNT_POINT" | trim)"
  [[ "$mounted_type" == "ext4" ]] || die "expected ext4 at $MOUNT_POINT, found $mounted_type"
  mounted_uuid="$(blkid -s UUID -o value "$mounted_real" | tr -d '[:space:]')"
  [[ "$mounted_uuid" == "$FILESYSTEM_UUID" ]] || die \
    "mounted UUID '$mounted_uuid' does not match formatted UUID '$FILESYSTEM_UUID'"
}

if [[ "$(id -u)" != "0" ]]; then
  die "run this script as root, for example: sudo bash prepare-server-storage.sh"
fi

require_commands \
  awk blkid blockdev chmod chown cp date find findmnt id install lsblk \
  mount mountpoint mkfs.ext4 readlink runuser sfdisk sleep stat swapoff \
  swapon umount udevadm

[[ -f /etc/fstab ]] || die "/etc/fstab is missing; refusing to continue"

TARGET_DEVICE="$(readlink -f -- "$TARGET_BY_ID" 2>/dev/null || true)"
[[ -n "$TARGET_DEVICE" ]] || die "stable target path is missing or unresolved: $TARGET_BY_ID"
verify_target_identity "$TARGET_DEVICE"

ROOT_DISK="$(find_root_disk)"
TARGET_REAL="$(readlink -f -- "$TARGET_DEVICE")"
ROOT_REAL="$(readlink -f -- "$ROOT_DISK")"
[[ "$TARGET_REAL" != "$ROOT_REAL" ]] || die \
  "refusing to format the root disk ($ROOT_REAL); target and root resolve to the same device"

OWNER_ACTUAL_UID="$(id -u "$OWNER_NAME" 2>/dev/null || true)"
OWNER_ACTUAL_GID="$(id -g "$OWNER_NAME" 2>/dev/null || true)"
[[ "$OWNER_ACTUAL_UID" == "$OWNER_UID" ]] || die \
  "user $OWNER_NAME must have UID $OWNER_UID (found '$OWNER_ACTUAL_UID')"
[[ "$OWNER_ACTUAL_GID" == "$OWNER_GID" ]] || die \
  "user $OWNER_NAME must have primary GID $OWNER_GID (found '$OWNER_ACTUAL_GID')"

fstab_mount_conflicts="$(fstab_entries_for_mountpoint)"
[[ -z "$fstab_mount_conflicts" ]] || die \
  "an /etc/fstab entry already targets $MOUNT_POINT; refusing to overwrite it:\n$fstab_mount_conflicts"

if [[ -L "$MOUNT_POINT" ]]; then
  die "$MOUNT_POINT is a symlink; refusing to mount over it"
fi
if [[ -e "$MOUNT_POINT" && ! -d "$MOUNT_POINT" ]]; then
  die "$MOUNT_POINT exists but is not a directory"
fi
if mountpoint -q -- "$MOUNT_POINT"; then
  die "$MOUNT_POINT is already mounted; refusing repeated setup"
fi
if [[ -d "$MOUNT_POINT" ]]; then
  existing_mountpoint_entry="$(find "$MOUNT_POINT" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null || true)"
  [[ -z "$existing_mountpoint_entry" ]] || die \
    "$MOUNT_POINT is non-empty; refusing to hide existing data with a new mount"
fi

mapfile -t existing_partitions < <(get_target_partitions)
for part in "${existing_partitions[@]}"; do
  part_type="$(lsblk -dnro FSTYPE "$part" 2>/dev/null | trim || true)"
  part_label="$(lsblk -dnro LABEL "$part" 2>/dev/null | trim || true)"
  if [[ "$part_type" == "ext4" && "$part_label" == "$FILESYSTEM_LABEL" ]]; then
    die "target already contains an ext4 partition labeled $FILESYSTEM_LABEL; refusing repeated setup"
  fi

  existing_uuid="$(blkid -s UUID -o value "$part" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$existing_uuid" ]] && fstab_has_uuid "$existing_uuid"; then
    die "an /etc/fstab entry already references target partition UUID $existing_uuid; refusing conflicting setup"
  fi
done

FSTAB_BACKUP="/etc/fstab.keystack-data.$(date -u +%Y%m%dT%H%M%SZ)"
[[ ! -e "$FSTAB_BACKUP" ]] || die "planned fstab backup already exists: $FSTAB_BACKUP"

printf '\n'
printf 'KeyStack server storage preparation\n'
printf 'The following device will be irreversibly erased after confirmation:\n'
printf '  stable path: %s\n' "$TARGET_BY_ID"
printf '  resolved device: %s\n' "$TARGET_DEVICE"
printf '  model: %s\n' "$EXPECTED_MODEL"
printf '  serial: %s\n' "$EXPECTED_SERIAL"
printf '  protected root disk: %s\n' "$ROOT_REAL"
printf '  new layout: GPT, one ext4 partition, label %s, reserved blocks 0%%\n' "$FILESYSTEM_LABEL"
printf '  mount: %s\n' "$MOUNT_POINT"
printf '\nCurrent target layout:\n'
lsblk -o NAME,SIZE,TYPE,FSTYPE,LABEL,MOUNTPOINTS "$TARGET_DEVICE"
printf '\nThis deletes all data on the verified Samsung SSD, including its existing partitions.\n'
printf 'It does not create a SQLite database or schema.\n'
if [[ ! -t 0 || ! -t 1 ]]; then
  die "an interactive terminal is required for the destructive confirmation"
fi

confirmation_token="ERASE $EXPECTED_SERIAL"
read -r -p "Type '$confirmation_token' exactly to continue: " confirmation
[[ "$confirmation" == "$confirmation_token" ]] || die "confirmation did not match; nothing was changed"

# Save fstab before any destructive disk operation. The backup is retained as
# a recovery record even if a later mount or verification step fails.
cp -a -- /etc/fstab "$FSTAB_BACKUP"
printf 'Saved /etc/fstab backup: %s\n' "$FSTAB_BACKUP"

# Re-check the by-id target immediately before formatting in case a USB device
# was disconnected and a different disk was enumerated in the meantime.
TARGET_DEVICE_AFTER_CONFIRMATION="$(readlink -f -- "$TARGET_BY_ID" 2>/dev/null || true)"
[[ "$TARGET_DEVICE_AFTER_CONFIRMATION" == "$TARGET_REAL" ]] || die \
  "stable target path changed after confirmation; refusing to format"
verify_target_identity "$TARGET_DEVICE_AFTER_CONFIRMATION"
ROOT_DISK_AFTER_CONFIRMATION="$(find_root_disk)"
ROOT_REAL_AFTER_CONFIRMATION="$(readlink -f -- "$ROOT_DISK_AFTER_CONFIRMATION")"
[[ "$TARGET_REAL" != "$ROOT_REAL_AFTER_CONFIRMATION" ]] || die \
  "target became the root disk after confirmation; refusing to format"

unmount_target_partitions

printf 'Creating a new GPT with one partition on %s\n' "$TARGET_REAL"
printf 'label: gpt\n,;\n' | sfdisk --wipe always --wipe-partitions always "$TARGET_REAL"

if command -v partprobe >/dev/null 2>&1; then
  partprobe "$TARGET_REAL"
else
  blockdev --rereadpt "$TARGET_REAL"
fi
udevadm settle

NEW_PARTITION=""
for attempt in {1..15}; do
  mapfile -t new_partitions < <(get_target_partitions)
  if [[ "${#new_partitions[@]}" -eq 1 ]]; then
    NEW_PARTITION="${new_partitions[0]}"
    break
  fi
  sleep 1
done
[[ -n "$NEW_PARTITION" ]] || die "new partition did not appear after rereading the partition table"

partition_table="$(lsblk -dnro PTTYPE "$TARGET_REAL" | trim)"
[[ "$partition_table" == "gpt" ]] || die "expected GPT partition table, found '$partition_table'"
mapfile -t new_partitions < <(get_target_partitions)
[[ "${#new_partitions[@]}" -eq 1 ]] || die "expected exactly one partition after partitioning"
[[ "${new_partitions[0]}" == "$NEW_PARTITION" ]] || die "partition layout changed unexpectedly"

printf 'Formatting %s as ext4 labeled %s (reserved blocks: 0%%)\n' "$NEW_PARTITION" "$FILESYSTEM_LABEL"
mkfs.ext4 -F -m 0 -L "$FILESYSTEM_LABEL" "$NEW_PARTITION"

FILESYSTEM_UUID="$(blkid -s UUID -o value "$NEW_PARTITION" | tr -d '[:space:]')"
[[ "$FILESYSTEM_UUID" =~ ^[[:xdigit:]-]+$ ]] || die "could not read a valid UUID from the new filesystem"
[[ "$(blkid -s TYPE -o value "$NEW_PARTITION" | tr -d '[:space:]')" == "ext4" ]] || \
  die "new partition does not report ext4"
[[ "$(blkid -s LABEL -o value "$NEW_PARTITION" | trim)" == "$FILESYSTEM_LABEL" ]] || \
  die "new partition does not report label $FILESYSTEM_LABEL"
NEW_PARTITION_REAL="$(readlink -f -- "$NEW_PARTITION")"

mkdir -p -- "$MOUNT_POINT"
chmod 0750 -- "$MOUNT_POINT"
mount -t ext4 -o "$RUNTIME_MOUNT_OPTIONS" "$NEW_PARTITION" "$MOUNT_POINT"
verify_mount
# Keep the filesystem root traversable by the service user while retaining a
# private-by-default mode. The data directories below have their own exact
# owner and mode checks.
chown "root:$OWNER_GID" "$MOUNT_POINT"
chmod 0750 -- "$MOUNT_POINT"

printf '\n# KeyStack cloud/server persistent data (Samsung SSD serial %s)\nUUID=%s %s ext4 %s 0 2\n' \
  "$EXPECTED_SERIAL" "$FILESYSTEM_UUID" "$MOUNT_POINT" "$FSTAB_OPTIONS" >> /etc/fstab

fstab_entry_count="$(awk -v source="UUID=$FILESYSTEM_UUID" -v mount_point="$MOUNT_POINT" -v options="$FSTAB_OPTIONS" '
  /^[[:space:]]*#/ { next }
  NF >= 4 && $1 == source && $2 == mount_point && $3 == "ext4" && $4 == options { count++ }
  END { print count + 0 }
' /etc/fstab)"
[[ "$fstab_entry_count" == "1" ]] || die "could not verify the new UUID fstab entry"

if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload || printf 'WARNING: systemd daemon-reload failed; reload it before starting the future cloud service.\n' >&2
fi

for data_directory in sqlite audio backups; do
  data_path="$MOUNT_POINT/$data_directory"
  mkdir -p -- "$data_path"
  chown "$OWNER_UID:$OWNER_GID" "$data_path"
  chmod 0750 -- "$data_path"
  [[ "$(stat -c '%u:%g' "$data_path")" == "$OWNER_UID:$OWNER_GID" ]] || \
    die "unexpected owner on $data_path"
  [[ "$(stat -c '%a' "$data_path")" == "750" ]] || die "unexpected mode on $data_path"
done

SMOKE_FILE="$MOUNT_POINT/sqlite/.keystack-storage-smoke-test.$$"
runuser --user "$OWNER_NAME" -- /bin/sh -c '
  set -eu
  smoke_file="$1"
  printf "KeyStack storage smoke test\\n" > "$smoke_file"
  test -s "$smoke_file"
  rm -f -- "$smoke_file"
  test ! -e "$smoke_file"
' /bin/sh "$SMOKE_FILE"
[[ ! -e "$SMOKE_FILE" ]] || die "storage smoke-test file was not deleted"

printf '\nStorage preparation complete.\n'
printf '  disk: %s (serial %s)\n' "$TARGET_REAL" "$EXPECTED_SERIAL"
printf '  filesystem: ext4 label %s UUID %s\n' "$FILESYSTEM_LABEL" "$FILESYSTEM_UUID"
printf '  mount: %s (persistent fstab entry)\n' "$MOUNT_POINT"
printf '  directories: sqlite, audio, backups owned by %s (%s:%s), mode 0750\n' "$OWNER_NAME" "$OWNER_UID" "$OWNER_GID"
printf '  fstab backup: %s\n' "$FSTAB_BACKUP"
printf '  no SQLite database or schema was created.\n'
printf '  service guard: the future cloud service must require %s with RequiresMountsFor= before starting, so it cannot fall back to the SD card.\n' "$MOUNT_POINT"
