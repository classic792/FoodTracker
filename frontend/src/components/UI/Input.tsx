import { useId } from 'react';

function toName(label: string | undefined, fallback :string) {
  if (!label) return fallback;
  return String(label)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

type InputType = {
  className? : string,
  label? : string,
  error? : undefined,
  as? : 'input' | 'textarea',
  id? :string,

} & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>

export default function Input({ className = '', label, error, as = 'input', id, name, ...props } : InputType) {
  const Component = as === 'textarea' ? 'textarea' : 'input';
  const autoId = useId();
  const inputId = id || `field-${autoId}`;
  const inputName = name || toName(label, inputId);

  return (
    <label className="block" htmlFor={inputId}>
      {label ? (
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      ) : null}
      <Component
        id={inputId}
        name={inputName}
        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 ${error ? 'border-red-400 focus:ring-red-100' : ''} ${className}`}
        {...props}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
