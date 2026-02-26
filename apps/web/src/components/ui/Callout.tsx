import type { HTMLAttributes } from 'react';

type Variant = 'info' | 'warn' | 'error' | 'success';

interface CalloutProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  title?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  info: 'callout-info',
  warn: 'callout-warn',
  error: 'callout-error',
  success: 'callout-success',
};

export function Callout({
  variant = 'info',
  title,
  onRetry,
  children,
  className = '',
  ...props
}: CalloutProps) {
  const classes = ['ui-callout', variantStyles[variant], className].filter(Boolean).join(' ');
  return (
    <div className={classes} {...props}>
      {title && <strong className="callout-title">{title}</strong>}
      <div className="callout-body">{children}</div>
      {onRetry && (
        <button type="button" className="callout-retry ui-btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
