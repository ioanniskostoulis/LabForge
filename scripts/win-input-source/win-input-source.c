// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Switch only the LabForge window's input locale, retaining its previous layout.
#include <windows.h>
#include <node_api.h>
#include <stdlib.h>
#include <string.h>

static HWND active_window = NULL;
static HKL previous_layout = NULL;

static napi_value js_boolean(napi_env env, BOOL value) {
  napi_value result;
  napi_get_boolean(env, value != FALSE, &result);
  return result;
}

static BOOL request_layout(HWND window, HKL layout) {
  if (!IsWindow(window)) return FALSE;
  DWORD thread = GetWindowThreadProcessId(window, NULL);
  if (!thread) return FALSE;
  DWORD_PTR ignored;
  // Keep the key path bounded if a window stops responding.
  if (!SendMessageTimeoutW(window, WM_INPUTLANGCHANGEREQUEST, 0, (LPARAM)layout,
                           SMTO_ABORTIFHUNG, 100, &ignored)) return FALSE;
  return GetKeyboardLayout(thread) == layout;
}

static napi_value begin(napi_env env, napi_callback_info info) {
  if (previous_layout) return js_boolean(env, TRUE);
  size_t argc = 1;
  napi_value argv[1];
  if (napi_get_cb_info(env, info, &argc, argv, NULL, NULL) != napi_ok || argc != 1)
    return js_boolean(env, FALSE);
  void *bytes = NULL;
  size_t length = 0;
  if (napi_get_buffer_info(env, argv[0], &bytes, &length) != napi_ok || length != sizeof(HWND))
    return js_boolean(env, FALSE);
  HWND window;
  memcpy(&window, bytes, sizeof(HWND));
  if (!IsWindow(window)) return js_boolean(env, FALSE);
  DWORD thread = GetWindowThreadProcessId(window, NULL);
  HKL current = GetKeyboardLayout(thread);
  if (!current) return js_boolean(env, FALSE);

  HKL english = NULL;
  if (PRIMARYLANGID(LOWORD((UINT_PTR)current)) == LANG_ENGLISH) english = current;
  else {
    int count = GetKeyboardLayoutList(0, NULL);
    if (count <= 0) return js_boolean(env, FALSE);
    HKL *layouts = (HKL *)malloc((size_t)count * sizeof(HKL));
    if (!layouts) return js_boolean(env, FALSE);
    count = GetKeyboardLayoutList(count, layouts);
    for (int index = 0; index < count; ++index) {
      if (PRIMARYLANGID(LOWORD((UINT_PTR)layouts[index])) == LANG_ENGLISH) {
        english = layouts[index];
        break;
      }
    }
    free(layouts);
  }
  if (!english || (english != current && !request_layout(window, english)))
    return js_boolean(env, FALSE);
  active_window = window;
  previous_layout = current;
  return js_boolean(env, TRUE);
}

static napi_value restore(napi_env env, napi_callback_info info) {
  if (!previous_layout) return js_boolean(env, TRUE);
  BOOL restored = previous_layout == GetKeyboardLayout(GetWindowThreadProcessId(active_window, NULL))
    || request_layout(active_window, previous_layout);
  if (restored || !IsWindow(active_window)) {
    active_window = NULL;
    previous_layout = NULL;
  }
  return js_boolean(env, restored);
}

static napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    { "begin", NULL, begin, NULL, NULL, NULL, napi_default, NULL },
    { "restore", NULL, restore, NULL, NULL, NULL, napi_default, NULL }
  };
  napi_define_properties(env, exports, 2, methods);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
