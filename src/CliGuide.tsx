import { ArrowRight, Download, Terminal } from 'lucide-react'

export function CliGuide() {
  return <section className="cli-guide" id="cli" aria-label="Terminal workflows">
    <Terminal size={17} aria-hidden="true" />
    <p><strong>Prefer the terminal?</strong> Configure KRAB, check nodes, and filter results.</p>
    <div className="cli-guide-actions">
      <a href="#docs/install"><Download size={13} aria-hidden="true" /> Get KRAB</a>
      <a href="#docs/tui">Guide <ArrowRight size={13} aria-hidden="true" /></a>
    </div>
  </section>
}
