# Run your own KRAB product

Deploy the same static website and native CLI with an operator-owned JSON profile. The shared Rust engine filters available choices, validates defaults, and keeps disabled settings fixed at those defaults. The website also omits disabled controls. Both interfaces retain **Powered by KRAB** attribution. This does not change the repository's Apache-2.0 license.

Profiles are a Next feature. Use the website and CLI artifacts built from the same source revision; the previously published 0.2.10 binary does not implement `--profile`.

## Run the website

Build the container from your chosen source revision. Docker builds Rust/WASM and the website; the running container only serves static files.

```sh
docker build -f Dockerfile.website -t krab-website .
docker run --rm -p 8080:80 \
  -v "$PWD/examples/product-profiles/coco.json:/usr/share/nginx/html/krab-profile.json:ro" \
  -v "$PWD/src/assets/brands/confidential-containers.svg:/usr/share/nginx/html/product-logo.svg:ro" \
  krab-website
```

Open `http://localhost:8080`. Without the profile mount, the image serves the ordinary KRAB builder. Edit the mounted JSON and reload to change the product; no image rebuild is needed. Invalid or unavailable profiles block the builder with an explanatory error. A missing profile file selects the ordinary builder.

The **Self-hosted website** CI artifact contains the same portable static files, built with relative asset URLs. Serve them from any static host, including a subdirectory. Copy a profile to `krab-profile.json` beside `index.html`, and copy its logo asset alongside it. No Node.js, Rust, application server, or cluster credentials are needed on that host.

## Use the matching CLI

Download the native archive for your platform from the same revision's **Native CLI** run. A product can redistribute those binaries together with its profile:

```sh
krab --profile examples/product-profiles/coco.json list catalog --json
krab --profile examples/product-profiles/coco.json init --non-interactive --output coco.yaml
krab --profile examples/product-profiles/coco.json edit --config coco.yaml
krab --profile examples/product-profiles/coco.json generate --config coco.yaml --output values.yaml
```

`KRAB_PROFILE=/path/to/profile.json` also works. For a bundled CLI, place `krab-profile.json` beside the executable; it loads automatically. An explicit `--profile` takes precedence over the environment and bundled profile. The TUI uses the product name and retains KRAB attribution; the profile's optional logo is a website asset.

## Configure the profile

Start with [the CoCo example](../examples/product-profiles/coco.json). It illustrates an amd64 CoCo-dev product with Nydus, without NVIDIA hardware choices or editable image pins. CoCo-dev is a development runtime without a hardware TEE. For a confidential workload product, select the appropriate TDX/SNP runtimes and test them on matching hardware. The example is not an official CoCo distribution.

| Field | Purpose |
| --- | --- |
| `apiVersion` | `krab/product/v1alpha1` |
| `id`, `name`, `description` | Product identity and website/TUI title |
| `logo` | Optional relative website asset path or HTTPS image URL |
| `available.vendors` | Allowed existing vendor/path IDs |
| `available.runtimes` | Allowed existing runtime IDs, across the selected vendors |
| `available.distributions` | Allowed Kubernetes distribution IDs |
| `available.architectures` | Allowed architecture IDs |
| `available.hardwareFamilies` | Allowed hardware family IDs; use `[]` for CPU-only products |
| `defaults` | Partial native KRAB configuration, using the same fields as `krab init` exports |

Omit an availability list to retain its existing choices. Empty required lists, unknown IDs or fields, incompatible defaults, and duplicate entries fail validation. Runtime reference data and chart versions remain pinned to the matching KRAB build. Removing GPU choices also removes GPU family modes that depend on them. Existing distribution compatibility checks still apply.

Feature flags default to `true`. Set any of these to `false`:

| Feature | Settings held at product defaults |
| --- | --- |
| `advanced` | All advanced, runtime, and component settings |
| `customRuntimes` | Custom RuntimeClasses |
| `continuousConformance` | Continuous host conformance |
| `newNodes` | Scheduled enrollment and its cron schedule |
| `imageOverrides` | Component images and the EROFS utility image |
| `components` | Component installation choices |
| `helmOverrides` | Raw Helm value overrides in the native editor |

A disabled feature can still be enabled by the operator in `defaults`; end users cannot change it through that configured product. Imported configurations use the same checks. Raw Helm overrides cannot bypass disabled features or restricted availability lists, and are not supported in product defaults. The profile configures the product; Kubernetes permissions and authorization remain the cluster operator's responsibility.

Validate a profile offline with `krab --profile profile.json list catalog --json`. Inspect `product.defaults` in that output for the engine's fully resolved starting configuration.
