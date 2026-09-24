import type React from "react";

const variants = {
  primary: 'bg-blue-900 text-white hover:bg-blue-800 focus:ring-blue-300',
  secondary: 'bg-white text-blue-900 border border-blue-900 hover:bg-blue-50 focus:ring-blue-200',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus:ring-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-200',
};

type ButtonProps = {
  variant? : keyof typeof variants,
  className? : String,
  type? : 'button' | 'submit' | 'reset',
  children? : React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...props
} : ButtonProps ) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
