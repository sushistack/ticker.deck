import { getCurrentWindow } from "@tauri-apps/api/window";
const isTauri = () => "__TAURI_INTERNALS__" in window;
export function startDragging() {
  if (isTauri())
    void getCurrentWindow()
      .startDragging()
      .catch(() => undefined);
}
export function minimizeWindow() {
  if (isTauri())
    void getCurrentWindow()
      .minimize()
      .catch(() => undefined);
}
export function closeWindow() {
  if (isTauri())
    void getCurrentWindow()
      .close()
      .catch(() => undefined);
}
