# Parse Test Fixtures

Image fixtures for testing OCR + text-parse pipelines.

## Structure

```
test/fixtures/
  adversaries/          # stat card images for adversary parsing
  environments/         # stat card images for environment parsing
    <name>.png          # source image
    <name>.expected.json  # expected parse output fields to verify
```

## Adding a new fixture

1. Drop the image into the appropriate collection subfolder.
2. Create a matching `.expected.json` with the fields you want to validate (name, tier, impulses, features, etc.).

## Running (future)

A test runner (`test/parse-fixtures.js`) will be added to run all images through OCR → `parseStatBlock` and diff against expected JSON.
