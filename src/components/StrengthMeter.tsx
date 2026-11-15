import { evaluateStrength } from "@/lib/strength";

export default function StrengthMeter({
  password,
  showHints = false,
  id,
}: {
  password: string;
  showHints?: boolean;
  id?: string;
}) {
  const result = evaluateStrength(password);
  const empty = password.length === 0;
  return (
    <div className="strength" id={id} data-score={empty ? "none" : result.score}>
      <div
        className="strength-bar"
        role="meter"
        aria-label="Siła hasła"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={empty ? 0 : result.score}
        aria-valuetext={empty ? "brak hasła" : result.label}
      >
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={!empty && i < Math.max(1, result.score) ? "on" : ""} />
        ))}
      </div>
      {!empty && (
        <p className="strength-label">
          Siła: <strong>{result.label}</strong>
          <span className="muted"> · ok. {result.entropyBits} bitów entropii</span>
        </p>
      )}
      {showHints && !empty && result.hints.length > 0 && (
        <ul className="strength-hints">
          {result.hints.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
