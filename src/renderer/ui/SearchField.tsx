/**
 * The search input of the library tabs. Who uses it: components/library (NodeLibrary, ModelLibrary, SubgraphLibrary).
 */
import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import styles from './SearchField.module.css';
import { cx } from './cx';

/** Props of SearchField: a controlled value and the two accessible names. */
export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'aria-label'> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name of the input. */
  label: string;
  /** Accessible name of the clear button. */
  clearLabel: string;
}

/** Search input with a leading icon and a clear button. Escape clears a non-empty value. */
const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onValueChange, label, clearLabel, className, onKeyDown, ...rest },
  ref,
) {
  return (
    <div className={cx(styles.field, className)}>
      <span className={styles.icon} aria-hidden="true"><Search size={14} /></span>
      <input
        ref={ref}
        type="search"
        aria-label={label}
        className={styles.input}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value !== '') {
            event.preventDefault();
            // The Escape that clears the field must not also close the panel or dialog around it.
            event.stopPropagation();
            onValueChange('');
          }
          onKeyDown?.(event);
        }}
        {...rest}
      />
      {value !== '' ? (
        <button type="button" className={styles.clear} aria-label={clearLabel} title={clearLabel} onClick={() => onValueChange('')}>
          <X size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
});

export default SearchField;
