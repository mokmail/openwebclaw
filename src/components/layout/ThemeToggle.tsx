// ---------------------------------------------------------------------------
// OpenWebClaw — Theme toggle component (OpenWebUI Design)
// ---------------------------------------------------------------------------

import { useThemeStore, type ThemeChoice } from '../../stores/theme-store.js';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const options: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const ActiveIcon = options.find((o) => o.value === theme)?.icon ?? Monitor;

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="p-1.5 rounded-lg hover:bg-base-300/50 text-base-content/70 hover:text-base-content transition-colors cursor-pointer">
        <ActiveIcon className="w-5 h-5" />
      </div>
      <ul tabIndex={0} className="dropdown-content menu bg-base-100 border border-base-300 rounded-xl shadow-lg z-50 w-36 p-1 mt-2">
        {options.map((opt) => (
          <li key={opt.value}>
            <button
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                theme === opt.value
                  ? 'bg-base-200 font-medium text-base-content'
                  : 'text-base-content/70 hover:bg-base-200/50 hover:text-base-content'
              }`}
              onClick={() => setTheme(opt.value)}
            >
              <opt.icon className="w-4 h-4" /> {opt.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
