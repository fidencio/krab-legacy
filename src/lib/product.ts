import { createAdvancedConfiguration, type ExplorerCatalog, type FamilySelections } from './artifacts'

export function productFeature(catalog: ExplorerCatalog, name: string) {
  return catalog.product?.features.advanced !== false && catalog.product?.features[name] !== false
}

/** Preserve native defaults directly, including auto component choices. */
export function productDefaults(catalog: ExplorerCatalog) {
  const defaults = catalog.product?.applyDefaults ? catalog.product.defaults : undefined
  return defaults ? websiteConfiguration(defaults) : null
}

export function websiteConfiguration(defaults: NonNullable<ExplorerCatalog['product']>['defaults']) {
  return {
    vendorId: defaults.vendor,
    deploymentName: defaults.release,
    selections: Object.fromEntries(Object.entries(defaults.hardware).map(([id, choice]) =>
      [id, { enabled: true, modeId: choice.mode, cpuTeeIds: choice.cpuTees }])) as FamilySelections,
    cluster: { distributionId: defaults.distribution, architectures: defaults.architectures, selinuxEnabled: defaults.selinux },
    runtime: { selectedShimIds: defaults.runtimes, runtimeHttpsProxy: defaults.runtime.httpsProxy,
      runtimeNoProxy: defaults.runtime.noProxy, nvidiaDcgmEnabled: defaults.runtime.nvidiaDcgm },
    advanced: { ...createAdvancedConfiguration(), ...structuredClone(defaults.advanced),
      components: structuredClone(defaults.components), erofsSnapshotterMode: defaults.runtime.erofsMode,
      erofsDiskSize: defaults.runtime.erofsDiskSize, erofsDmverity: defaults.runtime.erofsDmverity,
      erofsEnableFsverity: defaults.runtime.erofsFsverity, installErofsUtils: defaults.runtime.installErofsUtils },
  }
}
