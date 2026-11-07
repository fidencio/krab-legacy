import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { coreCatalog, coreRequest } from '../src/lib/core.ts'
import { buildCliConfiguration, type ExplorerCatalog } from '../src/lib/artifacts.ts'
import { productDefaults, productFeature } from '../src/lib/product.ts'

const profile = JSON.parse(readFileSync(new URL('../examples/product-profiles/coco.json', import.meta.url), 'utf8'))

test('product defaults round-trip through website controls with native component semantics', () => {
  const catalog = coreRequest<ExplorerCatalog>('product', undefined, coreCatalog, profile)
  const defaults = productDefaults(catalog)!
  const config = buildCliConfiguration(catalog.vendors[0], defaults.selections, defaults.cluster,
    defaults.runtime, defaults.advanced, defaults.deploymentName, catalog.plannedArchitecture.namespace)
  assert.deepEqual(coreRequest('generate', config, catalog), coreRequest('generate', catalog.product!.defaults, catalog))
  assert.equal(defaults.advanced.components.nfd, null, 'auto must remain auto through product initialization')
  assert.equal(productFeature(catalog, 'customRuntimes'), false)
  assert.equal(productFeature(catalog, 'imageOverrides'), false)
  assert.equal(productFeature(catalog, 'continuousConformance'), true)
  assert.throws(() => coreRequest('generate', { ...config, runtimes: ['qemu-runtime-rs'] }, catalog), /Unknown choice/)
  assert.equal(catalog.product!.attribution, 'Powered by KRAB')
})

test('a restricted NVIDIA CPU TDX profile retains its pinned reference data without exposing GPU options', () => {
  const catalog = coreRequest<ExplorerCatalog>('product', undefined, coreCatalog, {
    ...profile, available: { ...profile.available, runtimes: ['qemu-nvidia-cpu-tdx-runtime-rs'] },
    defaults: { ...profile.defaults, runtimes: ['qemu-nvidia-cpu-tdx-runtime-rs'] },
  })
  assert.equal(catalog.vendors[0].runtime.shims.length, 1)
  const values = coreRequest<Record<string, any>>('generate', catalog.product!.defaults, catalog)
  assert.equal(values['nvidia'].enabled, false)
  assert.equal(values['intel-tdx-qgs'].enabled, true)
})
