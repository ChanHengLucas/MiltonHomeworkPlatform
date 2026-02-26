import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children: React.ReactNode;
}

export function Card({ title, children, className = '', ...props }: CardProps) {
  return (
    <div className={`ui-card ${className}`} {...props}>
      {title && <h3 className="ui-card-title">{title}</h3>}
      {children}
    </div>
  );
}
