interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="hc-chips" aria-label="Suggestions">
      {suggestions.map((s) => (
        <button key={s} type="button" className="hc-chip" onClick={() => onSelect(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
