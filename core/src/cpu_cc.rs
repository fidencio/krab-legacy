//! Import the existing node-derived NVIDIA CPU CC overlay without inventing
//! guest paths, CoCo integrity metadata, or upstream built-in shim names.
use crate::advanced::{Advanced, CustomRuntime};
use crate::config::{find, Config, Result};
use serde_json::Value;

pub fn import_overlay(overlay: &Value, catalog: &Value) -> Result<Vec<CustomRuntime>> {
    let custom = &overlay["kata-deploy"]["customRuntimes"];
    if custom["enabled"] != true {
        return Err("Expected an enabled NVIDIA CPU CC custom-runtime overlay".into());
    }
    let runtimes = custom["runtimes"]
        .as_object()
        .filter(|v| !v.is_empty())
        .ok_or("CPU CC overlay has no runtime definitions")?;
    let mut result = Vec::new();
    for (name, runtime) in runtimes {
        let tee = match name.as_str() {
            "qemu-nvidia-cpu-tdx-runtime-rs" => "tdx",
            "qemu-nvidia-cpu-snp-runtime-rs" => "snp",
            _ => return Err(format!("Not a supported NVIDIA CPU CC handler: {name}")),
        };
        let expected_base = format!("qemu-nvidia-gpu-{tee}-runtime-rs");
        if runtime["baseConfig"] != expected_base
            || runtime["containerd"]["snapshotter"] != "nydus"
            || runtime["crio"]["pullType"] != "guest-pull"
            || runtime["inheritBaseOverhead"] != true
        {
            return Err(format!("{name}: CPU CC base, snapshotter, CRI, or overhead settings do not match the generated overlay"));
        }
        let drop_in = runtime["dropIn"]
            .as_str()
            .filter(|v| !v.trim().is_empty())
            .ok_or("CPU CC drop-in is missing")?;
        let class = runtime["runtimeClass"]
            .as_str()
            .ok_or("CPU CC RuntimeClass is missing")?;
        let manifest: Value = serde_yaml_ng::from_str(class)
            .map_err(|e| format!("Invalid CPU CC RuntimeClass: {e}"))?;
        let handler = format!("kata-{name}");
        let label = if tee == "tdx" {
            "intel.feature.node.kubernetes.io/tdx"
        } else {
            "amd.feature.node.kubernetes.io/snp"
        };
        let resource = if tee == "tdx" {
            "tdx.intel.com/keys"
        } else {
            "sev-snp.amd.com/esids"
        };
        let selector = &manifest["scheduling"]["nodeSelector"];
        if manifest["handler"] != handler
            || manifest["metadata"]["name"] != handler
            || selector[label] != "true"
            || selector["kubernetes.io/arch"] != "amd64"
            || !selector["nvidia.com/cc.ready.state"].is_null()
            || manifest["overhead"]["podFixed"][resource] != "1"
        {
            return Err(format!("{name}: RuntimeClass does not retain the CPU-only scheduling and TEE resource requirements"));
        }
        result.push(CustomRuntime {
            name: name.clone(),
            base_config: expected_base,
            drop_in: drop_in.into(),
            runtime_class: class.into(),
            crio_pull_type: Some("guest-pull".into()),
            inherit_base_overhead: Some(true),
        });
    }
    let vendor = find(&catalog["vendors"], "custom")?;
    Advanced {
        custom_runtimes: result.clone(),
        ..Advanced::default()
    }
    .validate(vendor)?;
    Ok(result)
}

pub fn configuration(overlay: &Value, catalog: &Value, existing: Option<Config>) -> Result<Config> {
    let profiles = import_overlay(overlay, catalog)?;
    let mut config = if let Some(config) = existing {
        config
    } else {
        let mut config = crate::starter(catalog, "custom", "kubeadm", "amd64")?;
        config.runtimes.clear();
        config
    };
    for profile in profiles {
        config
            .advanced
            .custom_runtimes
            .retain(|old| old.name != profile.name);
        config.advanced.custom_runtimes.push(profile);
    }
    crate::values::build(&config, catalog)?;
    Ok(config)
}
