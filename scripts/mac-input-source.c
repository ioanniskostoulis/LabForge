// Licensed under the GNU General Public License v2 or later. See LICENSE.
// Input source selection must happen in Electron's process.
#include <Carbon/Carbon.h>
#include <node_api.h>

static TISInputSourceRef previous = NULL;

static napi_value boolean(napi_env env, bool value) {
  napi_value result;
  napi_get_boolean(env, value, &result);
  return result;
}

static napi_value begin(napi_env env, napi_callback_info info) {
  if (previous) return boolean(env, true);
  TISInputSourceRef current = TISCopyCurrentKeyboardInputSource();
  TISInputSourceRef english = TISCopyInputSourceForLanguage(CFSTR("en"));
  if (!current || !english) {
    if (current) CFRelease(current);
    if (english) CFRelease(english);
    return boolean(env, false);
  }
  OSStatus status = TISSelectInputSource(english);
  CFRelease(english);
  if (status == noErr) previous = current;
  else CFRelease(current);
  return boolean(env, status == noErr);
}

static napi_value restore(napi_env env, napi_callback_info info) {
  if (!previous) return boolean(env, true);
  OSStatus status = TISSelectInputSource(previous);
  if (status == noErr) {
    CFRelease(previous);
    previous = NULL;
  }
  return boolean(env, status == noErr);
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
