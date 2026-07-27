# Asset Sources

This public repository contains only assets that are approved for this experimental demo.

| File                                 | Source                                    | Rights / permission                                                                             | User provided | Public use               | Transformation                                                                                                                                     |
| ------------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/assets/character-source.png` | User-supplied conversation attachment     | The user explicitly stated that the image may be used for this playground                       | Yes           | Yes, for this repository | Re-encoded as RGB PNG; DPI and all other metadata removed; responsive crop only                                                                    |
| `public/assets/fonts/lsvis-td.woff2` | User-supplied `LSVIS TD.woff2` attachment | The user explicitly instructed this playground to replace the OTF with the faster-loading WOFF2 | Yes           | Yes, for this repository | Renamed for a stable URL; SHA-256 `4BBB34BD34B7525CFF4447E38192AA123614E4CFCB64B97CFA3DD169F16A84BC`; loaded as a temporary, replaceable demo font |

The character remains a separate image layer. The application UI, icons, text, glass surfaces, metrics and controls are rendered by code and are not baked into the image.

The demo font is not a permanent branding decision. Its internal family name is `LSVIS TD`; replace the file and the `--font-brand` / `--font-ui` token definitions when the final font is supplied.
