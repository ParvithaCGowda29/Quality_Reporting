// BuLLM logo (bull mark + wordmark, src/assets/bullm-logo.png). Used in the top bar (with the muted product tag
// beside it) and on login. Sized from one font size (`--bl`).
import './brand.css'
import logo from '../assets/bullm-logo.png'

export function BrandLockup({ className = '', tag }: { className?: string; tag?: string }) {
  return (
    <span className={`brand-lockup ${className}`} role="img" aria-label={tag ? `BuLLM, ${tag}` : 'BuLLM'}>
      <img className="brand-logo" src={logo} alt="" aria-hidden />
      {tag && <span className="brand-tag" aria-hidden>{tag}</span>}
    </span>
  )
}
