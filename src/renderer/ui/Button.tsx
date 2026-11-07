import React from 'react';
import { motion } from 'motion/react';
import { useMotionPolicy } from './policy';

interface ButtonProps {
  variant?: 'quiet' | 'primary' | 'warn';
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'quiet', className = '', disabled, children, type = 'button', onClick, title },
  ref,
) {
  const policy = useMotionPolicy();
  return (
    <motion.button
      ref={ref}
      type={type}
      title={title}
      className={`ghost-button ui-button ui-button-${variant} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled || policy.shift === 0 ? undefined : { y: 1 }}
      transition={{ duration: policy.feedback, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </motion.button>
  );
});
