import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

const sizeStyles: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const classes = [
    'ui-btn',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'btn-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}
