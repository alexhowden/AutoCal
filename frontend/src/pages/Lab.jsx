import { PageHead, Corners, SegBar } from '../components/ui.jsx'
import Shell from './Shell.jsx'
import './lab.css'

const navIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1.5" y="1.5" width="5.2" height="5.2" />
    <rect x="9.3" y="1.5" width="5.2" height="5.2" />
    <rect x="1.5" y="9.3" width="5.2" height="5.2" />
    <rect x="9.3" y="9.3" width="5.2" height="5.2" />
  </svg>
)

function NavCard({ code, cls }) {
  return (
    <div className={`lnav ${cls}`}>
      <span className="lab-label" style={{ padding: '0 2px 6px' }}>
        {code}
      </span>
      <div className="lnav-item on">
        {cls === 'n3' && <Corners />}
        <span className="lnav-in">{navIcon} Dashboard</span>
      </div>
      <div className="lnav-item">
        <span className="lnav-in">{navIcon} Chat</span>
      </div>
    </div>
  )
}

export default function Lab() {
  return (
    <>
      <PageHead title="UI Lab // pick & choose">
        <span>round 3</span>
        <span>renumbered + fresh frames</span>
      </PageHead>

      <div className="lab-section">
        <span className="micro">buttons</span>
        <div className="lab-row">
          <div className="lab-card">
            <span className="lab-label">B1 // closed chamfer rail</span>
            <div className="lab-samples">
              <button className="cbtn rail">
                <span className="cbtn-in">Send</span>
              </button>
              <button className="cbtn rail primary">
                <span className="cbtn-in">Send</span>
              </button>
            </div>
            <span className="lab-note">was B2 - benched, in case we switch it up</span>
          </div>

          <div className="lab-card">
            <span className="lab-label">B2 // corner brackets</span>
            <div className="lab-samples">
              <button className="bbtn">
                <Corners />
                Send
              </button>
              <button className="bbtn primary">
                <Corners />
                Send
              </button>
            </div>
            <span className="lab-note">was B3 - benched, cyan corners mark it clickable</span>
          </div>

          <div className="lab-card">
            <span className="lab-label">B3 // heavy brackets</span>
            <div className="lab-samples">
              <button className="hbtn">
                <i className="hbk hbk1" />
                <i className="hbk hbk2" />
                <i className="hbk hbk3" />
                <i className="hbk hbk4" />
                Send
              </button>
            </div>
            <span className="lab-note">was B5 - the universal button, live app-wide</span>
          </div>
        </div>
      </div>

      <div className="lab-section">
        <span className="micro">panel frames</span>
        <div className="lab-frames">
          <div className="fr f1">
            <div className="fr-inner">
              <span className="fr-title">F1 // current</span>
              <span className="fr-text">Kept as-is. Gradient hairline, chamfered corners, soft glow.</span>
            </div>
          </div>

          <div className="fr f2">
            <div className="fr-band">
              <span className="fr-title">F2 // header band</span>
            </div>
            <div className="fr-pad">
              <span className="fr-text">Was F5. Kept for special cases - solid title band over a plain shell.</span>
            </div>
          </div>

          <div className="fr f3">
            <div className="f3-in">
              <span className="fr-title">F3 // node header</span>
              <div className="node-line">
                <i className="nd" />
                <i className="nl" />
                <i className="nd" />
              </div>
              <span className="fr-text">Was F15. Clean closed shell with a node-terminated divider under the title.</span>
            </div>
          </div>

          <div className="fr f4">
            <div className="f4-in">
              <i className="f4-bar" />
              <span className="fr-title">F4 // notch crown</span>
              <span className="fr-text">New. The forge shell's top notch, miniaturized onto a hairline panel, with a glowing bar seated under the dip.</span>
            </div>
          </div>

          <div className="fr f5">
            <div className="f5-in">
              <div className="f5-wire">
                <i className="fw-dot" />
                <i className="fw-v" />
                <svg className="fw-diag" width="14" height="12" viewBox="0 0 14 12">
                  <path d="M3 0 V2 L11 10 V12" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
                <i className="fw-v2" />
                <i className="fw-dot d2" />
              </div>
              <span className="fr-title">F5 // wire spine</span>
              <span className="fr-text">New. A node-to-node wire with a 45-degree jog runs the left edge - the shell's wire language on an everyday panel. Stretches to any height.</span>
            </div>
          </div>

          <div className="fr f6">
            <div className="f6-in">
              <i className="f6-dot" />
              <span className="fr-title">F6 // stepped corner</span>
              <span className="fr-text">New. Two-step stair cuts on opposite corners instead of a plain chamfer, node dot seated in the upper step.</span>
            </div>
          </div>

          <div className="fr f7">
            <div className="f7-in">
              <i className="f7-vents" />
              <span className="fr-title">F7 // corner vents</span>
              <span className="fr-text">New. The shell's slanted stripes tucked into the top-right corner - ends slanted to match the stripe angle, never cut vertical.</span>
            </div>
          </div>

          <div className="fr f8">
            <div className="f8-in">
              <div className="f8-head">
                <div className="f8-band">
                  <span className="f8-band-in">
                    <span className="fr-title">F8 // slant band</span>
                  </span>
                </div>
                <i className="f8-dot" />
                <i className="f8-line" />
              </div>
              <span className="fr-text">New. Outlined title band with a slanted tail end, handed off to a node dot and a hairline that runs out to the edge.</span>
            </div>
          </div>

          <div className="fr f9">
            <div className="f9-in">
              <i className="f9-echo" />
              <i className="f9-dot" />
              <div className="f9-body">
                <span className="fr-title">F9 // echo shell</span>
                <span className="fr-text">New. Chamfered shell with an inner echo line tracing the same silhouette, node dot pinned to the echo's corner.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lab-section">
        <span className="micro">hud bits</span>
        <div className="lab-row">
          <div className="lab-card">
            <span className="lab-label">L1 // loading module</span>
            <div className="lab-samples">
              <div className="l1" style={{ color: 'var(--red)' }}>
                <div className="l1-circ">
                  <svg viewBox="0 0 64 64" className="spin">
                    <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="11 7" />
                  </svg>
                  <svg viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.45" />
                  </svg>
                  <span className="l1-pct">62%</span>
                </div>
                <div className="l1-right">
                  <span className="l1-label">SYNCING</span>
                  <SegBar frac={0.62} count={16} />
                </div>
              </div>
            </div>
          </div>

          <div className="lab-card">
            <span className="lab-label">L2 // processing</span>
            <div className="lab-samples">
              <div className="l1" style={{ color: 'var(--cyan-data)' }}>
                <div className="l1-circ">
                  <svg viewBox="0 0 64 64" className="spin">
                    <circle cx="32" cy="32" r="27" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="11 7" />
                  </svg>
                  <svg viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.45" />
                  </svg>
                  <span className="l1-pct">//</span>
                </div>
                <div className="l1-right">
                  <span className="l1-label">PROCESSING</span>
                  <SegBar pulse count={16} />
                </div>
              </div>
            </div>
          </div>

          <div className="lab-card">
            <span className="lab-label">S1 // tile shell</span>
            <div className="s1-wrap">
              <svg width="90" height="90" viewBox="0 0 90 90" style={{ color: 'var(--red)' }}>
                <rect x="9" y="9" width="72" height="72" stroke="currentColor" strokeWidth="1.5" fill="rgb(255 42 69 / 0.05)" />
                <path d="M4 22 V4 H22" stroke="currentColor" strokeWidth="3" fill="none" />
                <path d="M68 4 H86 V22" stroke="currentColor" strokeWidth="3" fill="none" />
                <path d="M86 68 V86 H68" stroke="currentColor" strokeWidth="3" fill="none" />
                <path d="M22 86 H4 V68" stroke="currentColor" strokeWidth="3" fill="none" />
                {[0, 1, 2, 3].map((i) => (
                  <rect key={i} x="75" y={28 + i * 10} width="3" height="5" fill="currentColor" />
                ))}
              </svg>
              <span className="lab-note">kept as-is</span>
            </div>
          </div>
        </div>

        <div className="lab-card">
          <span className="lab-label">D1-D3 // dividers, rebuilt responsive</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="dvd d1">
              <i className="d1-cap" />
              <i className="d1-line" />
              <i className="d1-trap" />
              <i className="d1-line" />
              <i className="d1-tail" />
            </div>
            <div className="dvd d2">
              <i className="d2-blk" />
              <i className="d2-blk" />
              <i className="d2-blk" />
              <i className="d2-blk" />
              <i className="d2-line" />
              <i className="d2-tail" />
            </div>
            <div className="dvd d3">
              <i className="d3-bar" />
              <i className="d3-line" />
              <i className="d3-cap" />
            </div>
          </div>
          <span className="lab-note">now flex segments instead of stretched svg - they resize cleanly</span>
        </div>
      </div>

      <div className="lab-section">
        <span className="micro">shell // fit mode (stretchy body, fixed details)</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 150 }}>
            <Shell fit active />
          </div>
          <div style={{ height: 220, width: '70%' }}>
            <Shell fit />
          </div>
        </div>
      </div>

      <div className="lab-section">
        <span className="micro">sidebar active states</span>
        <div className="lab-navs">
          <NavCard code="N1 // current rail" cls="n1" />
          <NavCard code="N2 // chamfer fill, closed" cls="n2" />
          <NavCard code="N3 // brackets" cls="n3" />
          <NavCard code="N4 // slant tab" cls="n4" />
          <NavCard code="N8 // node rail" cls="n8" />
        </div>
      </div>
    </>
  )
}
