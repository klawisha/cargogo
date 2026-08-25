# Test report 1.2.4

Static regression checks cover the exact Android failure `Unsupported FormDataPart implementation`: the verification screen must use Expo File objects, must not append legacy `{uri,name,type}` objects, must not use Blob conversion, and FormData requests must use `expo/fetch`.

Run locally after npm install:

```powershell
npm run typecheck
npm run verify:verification
npm run verify:verification-upload
npm run verify:verification-mobile
npm run verify:economics
npm run verify:payments
```

Physical-device test remains required for the native DocumentPicker -> multipart -> API -> private MinIO path.
