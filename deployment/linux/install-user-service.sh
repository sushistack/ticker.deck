#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -eq 0 ]]; then
  echo "Run this installer as the graphical desktop user, not root." >&2
  exit 1
fi

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
user_unit_dir=${XDG_CONFIG_HOME:-"${HOME}/.config"}/systemd/user
config_dir=${XDG_CONFIG_HOME:-"${HOME}/.config"}/tickerdeck
packaged_unit=/usr/lib/systemd/user/tickerdeck.service

mkdir -p "${user_unit_dir}" "${config_dir}"
if [[ ! -f ${packaged_unit} ]]; then
  install -m 0644 "${script_dir}/tickerdeck.service" "${user_unit_dir}/tickerdeck.service"
fi

if [[ ! -f ${config_dir}/appliance.env ]]; then
  umask 077
  printf '%s\n' 'TICKERDECK_APPLIANCE_MODE=1' 'TICKERDECK_DISPLAY_ON=07:00' 'TICKERDECK_DISPLAY_OFF=00:00' > "${config_dir}/appliance.env"
fi

systemctl --user import-environment DISPLAY XAUTHORITY WAYLAND_DISPLAY DBUS_SESSION_BUS_ADDRESS || true
systemctl --user daemon-reload
systemctl --user enable --now tickerdeck.service

if [[ ${XDG_SESSION_TYPE:-unknown} != x11 ]]; then
  echo "Warning: physical DPMS requires an Ubuntu on Xorg session; the app will report Wayland as unsupported." >&2
fi
systemctl --user --no-pager status tickerdeck.service || true
