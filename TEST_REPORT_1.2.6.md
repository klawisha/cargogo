# Test report — v1.2.6

Static/regression checks performed during packaging:
- no `Response.blob()` in verification upload path
- no `FormData` binary bridge in verification screen
- no `FileSystem.copyAsync` in verification screen
- DocumentPicker keeps `copyToCacheDirectory: true`
- native `FileSystem.uploadAsync` remains the binary transport
- upload points at authenticated `/verification/documents/upload`
- backend upload/magic-byte/ownership verification files preserved
- marketplace economics and LiqPay fixtures unchanged

Physical Android/Expo Go validation must still be run on the target device.
