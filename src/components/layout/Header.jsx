import ThemeToggle from '../ThemeToggle'

export default function Header({ accountCount, onLogoClick }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-revos-surface shrink-0">
      <div
        className={`flex items-center gap-2.5 ${onLogoClick ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={onLogoClick}
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-revos-cyan to-revos-purple flex items-center justify-center font-mono font-bold text-xs text-revos-bg">
          R
        </div>
        <div>
          <div className="font-mono font-bold text-[13px] tracking-tight">
            RevOS
          </div>
          <div className="font-sans text-[9px] text-revos-text-dim tracking-wide">
            Bayesian Prediction · Game Theory · Signal Intelligence
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-sans text-[9px] text-revos-text-dim">
          Live · {accountCount} accounts
        </span>
        <ThemeToggle />
      </div>
    </div>
  )
}
