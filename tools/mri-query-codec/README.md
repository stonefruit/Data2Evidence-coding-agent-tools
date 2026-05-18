# MRI Query Codec

Small Node helper for encoding and decoding compressed MRI query payloads.

## Usage

```bash
cd tools/mri-query-codec
node src/cli.js decode '<payload>'
echo '{"metadata":{"version":3}}' | node src/cli.js encode
```

The tool uses Node's built-in `zlib`; no package install is required for tests or CLI use.

## Test

```bash
npm test
```
