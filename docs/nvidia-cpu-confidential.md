# NVIDIA CPU confidential workloads

KRAB 0.2.8 includes experimental NVIDIA CPU TDX and SNP handlers using Kata's
existing custom-runtime support. The node-derived helper removes the GPU guest
extension from the corresponding installed confidential GPU configuration,
retaining the confidential kernel, firmware, CoCo extension and integrity
metadata, reference kernel arguments, and CPU TEE scheduling requirements.
These are custom handlers, not new upstream built-in shim names.

On a node with the matching pinned Kata installation and Python 3.11+:

```sh
python3 nvidia-cpu-cc.py --tee tdx > nvidia-cpu-tdx.values.json
```

Use `--tee snp` for SNP, or `--tee both` when both reference files are present.
The helper is included in CLI archives and downloadable from the website's
NVIDIA CPU guide. It reads `/opt/kata/share/defaults/kata-containers/runtime-rs`
without modifying the host. `--config-dir` selects another reference directory;
it does not relocate the paths inside its files. Generation fails without
partial output if confidential settings or CoCo integrity metadata are missing.

Import the resulting overlay in the website using **Import NVIDIA CPU TDX / SNP**,
or create a native configuration:

```sh
krab import-cpu-cc --values nvidia-cpu-tdx.values.json --output cpu-cc.yaml
krab edit --config cpu-cc.yaml
krab generate --config cpu-cc.yaml --output values.yaml
```

To merge it into an existing configuration, supply `--config existing.yaml` and
choose a separate output. Both importers use the same Rust code. They preserve
CPU-only scheduling, inherited base overhead, the CPU TEE extended resource,
Nydus, and CRI-O guest-pull settings. TDX also selects QGS automatically unless
explicitly overridden. No GPU device plugin or provisioner is enabled just by
importing a CPU confidential handler.

Review generated values before deploying. The reference configurations must
match the Kata image and installation prefix used by the target nodes. Recreate
these overlays after upgrading Kata. CPU TDX and SNP require compatible hosts;
configuration generation and host pre-checks do not establish that the guest
boots or attests. Verify both on suitable hardware before running workloads.

The GPU base may still cause Kata to stage a GPU extension artifact on the host;
the CPU custom handler does not attach that extension to the guest. Its kernel
arguments are pinned from the reference so enabling DCGM for a separate GPU
handler does not enable it in the CPU guest.
