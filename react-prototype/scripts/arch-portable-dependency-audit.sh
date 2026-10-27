#!/usr/bin/env bash
# Headless ABI audit of the unsigned portable preview inside a disposable
# Arch Linux container. Electron is NEVER launched with administrator rights.
set -euo pipefail
if [[ "${OMSI_ARCH_AUDIT_SCOPE:-}" != "CI_UNSIGNED_PACKAGE_ONLY" ]]; then
  printf '%s\n' 'ARCH_AUDIT_REFUSED: explicit CI scope missing' >&2
  exit 3
fi
if [[ "$#" -ne 1 ]]; then
  printf '%s\n' 'ARCH_AUDIT_REFUSED: one package path required' >&2
  exit 3
fi
root="$1"
if [[ ! -d "$root" || -L "$root" ]]; then
  printf '%s\n' 'ARCH_AUDIT_REFUSED: unsafe package root' >&2
  exit 3
fi
binary="$root/OMSI-Manager-Preview"
launcher="$root/OMSI-Manager-Preview.sh"
archive="$root/resources/app.asar"
for target in "$binary" "$launcher" "$archive"; do
  if [[ ! -f "$target" || -L "$target" ]]; then
    printf '%s\n' 'ARCH_AUDIT_REFUSED: invalid package layout' >&2
    exit 3
  fi
done
if [[ ! -x "$binary" || ! -x "$launcher" || ! -s "$archive" ]]; then
  printf '%s\n' 'ARCH_AUDIT_REFUSED: executable or app.asar missing' >&2
  exit 3
fi
readelf -h "$binary" | grep -Eq 'Class:[[:space:]]+ELF64'
readelf -h "$binary" | grep -Eq 'Machine:[[:space:]]+Advanced Micro Devices X86-64'
sh -n "$launcher"
if grep -Eq -- '--no-sandbox|--disable-web-security|sudo|pkexec' "$launcher"; then
  printf '%s\n' 'ARCH_AUDIT_FAILED: unsafe launcher switch' >&2
  exit 1
fi
# Only the trusted CI-built package is inspected, never user mods or binaries.
check_links(){
  local target="$1"
  local output
  if ! output="$(ldd "$target" 2>&1)"; then
    printf '%s\n' 'ARCH_AUDIT_FAILED: ELF loader refused a binary' >&2
    exit 1
  fi
  if grep -Fq 'not found' <<<"$output"; then
    printf '%s\n' 'ARCH_AUDIT_FAILED: unresolved Arch dynamic libraries' >&2
    grep -F 'not found' <<<"$output" >&2
    exit 1
  fi
}
auto_launcher="$root/OMSI-Manager-Auto"
if [[ ! -x "$auto_launcher" || -L "$auto_launcher" ]]; then
  printf '%s\n' 'ARCH_AUDIT_FAILED: portable auto-launcher missing' >&2
  exit 1
fi
readelf -h "$auto_launcher" | grep -Eq 'Class:[[:space:]]+ELF64'
check_links "$auto_launcher"
check_links "$binary"
for file in "$root"/*.so "$root"/*.so.*; do
  [[ -f "$file" && ! -L "$file" ]] || continue
  check_links "$file"
done
printf '%s\n' 'PASS_ARCH_LINUX_CONTAINER_ELF_DEPENDENCIES_AND_PORTABLE_LAYOUT'
