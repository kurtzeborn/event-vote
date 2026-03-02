import { THEMES, THEME_IDS } from '../themes.ts';

export default function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (themeId: string) => void;
}) {
  return (
    <div className="flex gap-3">
      {THEME_IDS.map((id) => {
        const theme = THEMES[id];
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              selected ? 'ring-2 ring-offset-2 ring-gray-900 scale-105' : 'opacity-70 hover:opacity-100'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg ${theme.swatch}`} />
            <span className="text-xs font-medium text-gray-600">{theme.name}</span>
          </button>
        );
      })}
    </div>
  );
}
