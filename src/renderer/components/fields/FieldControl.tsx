import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as S from '@radix-ui/react-switch';
import { Check, ChevronsUpDown, Dices, Minus, Plus } from 'lucide-react';
import type { FieldSpec } from '../../../shared/contracts/knowledge';
import { PopoverContent, PopoverRoot, PopoverTrigger } from '../../ui/Popover';
import { cx } from '../../ui/cx';
import {
  baseName,
  clampToSpec,
  controlKind,
  displayValue,
  filterOptions,
  isSeedField,
  isUnset,
  randomSeed,
  SEARCH_THRESHOLD,
  stepValue,
  type ControlKind,
} from './fieldModel';
import { ModelList, useFieldModels } from './ModelList';
import styles from './FieldControl.module.css';

export type FieldVariant = 'node' | 'panel';

export interface FieldControlProps {
  /** The canvas node; the model picker asks main about this node's graph neighbours. */
  nodeId: string;
  name: string;
  value: unknown;
  spec?: FieldSpec;
  /** 'node': compact, inside a React Flow node. 'panel': full width in Properties. */
  variant: FieldVariant;
  disabled?: boolean;
  /** id of a visible label that names the control (Properties); the node row labels by the field name. */
  labelledBy?: string;
  onCommit: (value: unknown) => void;
}

/**
 * One control for one node field, used on the canvas and in Properties so both read and behave the same:
 * a list (searchable past eight options; a picker of the person's files for model fields), a number stepper with
 * the range and step from object_info, a switch, a one-line input or a growing text box for prompts.
 * Values are committed on choose, on step, on Enter or when focus leaves; the caller turns that into the
 * set-parameter command, so undo and revisions see every edit. Inside a node every control carries
 * `nodrag nowheel` so typing, selecting and scrolling never move the canvas.
 */
export default function FieldControl(props: FieldControlProps) {
  const kind = controlKind(props.spec, props.value);
  const inNode = props.variant === 'node';
  const className = cx(styles.root, inNode ? styles.compact : styles.wide, inNode && 'nodrag nowheel');
  return (
    <div className={className} data-field-kind={kind} data-field-name={props.name}>
      <Control kind={kind} {...props} />
    </div>
  );
}

function Control({ kind, ...props }: FieldControlProps & { kind: ControlKind }) {
  const { t } = useTranslation();
  switch (kind) {
    case 'combo':
      return <ComboControl {...props} />;
    case 'int':
    case 'float':
      return <NumberControl {...props} kind={kind} />;
    case 'boolean':
      return <BooleanControl {...props} />;
    case 'string':
      return <TextControl {...props} multiline={Boolean(props.spec?.multiline)} />;
    case 'json':
      return <TextControl {...props} multiline={false} json />;
    default:
      return (
        <span className={styles.readOnly} title={String(t('field.otherWidget'))}>
          {isUnset(props.value) ? <span className={styles.unset}>{t('field.unset')}</span> : displayValue(props.value)}
        </span>
      );
  }
}

/** aria props shared by the controls: a visible label when there is one, else the field name. */
function nameProps(props: Pick<FieldControlProps, 'labelledBy' | 'name'>): Record<string, string> {
  return props.labelledBy ? { 'aria-labelledby': props.labelledBy } : { 'aria-label': props.name };
}

function ComboControl({ nodeId, name, value, spec, variant, disabled, labelledBy, onCommit }: FieldControlProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const options = useMemo(() => (spec?.options ?? []).filter((option) => option !== ''), [spec?.options]);
  const modelField = Boolean(spec?.modelDirectory);
  const models = useFieldModels(nodeId, name, modelField && open);
  const modelRows = models.state === 'ready' && models.result.models ? models.result.options : null;
  const searchable = options.length > SEARCH_THRESHOLD || modelField;
  const shown = useMemo(() => {
    const base = modelRows ? modelRows.map((row) => row.value) : options;
    return filterOptions(base, query);
  }, [modelRows, options, query]);
  const text = displayValue(value);
  const unset = isUnset(value) || text === '';
  const missing = !unset && options.length > 0 && !options.includes(text);
  useEffect(() => {
    if (open) setQuery('');
  }, [open]);
  // Start on the current value, also once the model rows arrive in their fit order.
  useEffect(() => {
    if (open && query === '') setActive(Math.max(0, shown.indexOf(text)));
  }, [open, query, shown, text]);
  useEffect(() => {
    if (!open) return;
    const element = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    element?.scrollIntoView({ block: 'nearest' });
  }, [active, open, shown]);
  const choose = (next: string) => {
    setOpen(false);
    if (next !== text) onCommit(next);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.max(0, Math.min(shown.length - 1, current + delta)));
    } else if (event.key === 'Home' || event.key === 'End') {
      if (event.target instanceof HTMLInputElement) return;
      event.preventDefault();
      setActive(event.key === 'Home' ? 0 : Math.max(0, shown.length - 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const picked = shown[active];
      if (picked !== undefined) choose(picked);
    }
  };
  const label = modelField ? baseName(text) : text;
  const activeId = shown[active] !== undefined ? `${listId}-${active}` : undefined;
  return (
    <PopoverRoot open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className={cx(styles.trigger, missing && styles.missing)}
          disabled={disabled}
          title={missing ? `${text} — ${String(t('field.notInListHint'))}` : text || undefined}
          data-value={text}
          {...nameProps({ labelledBy, name })}
        >
          <span className={cx(styles.triggerText, unset && styles.unset)}>{unset ? t('field.unset') : label}</span>
          {missing ? <span className={styles.missingMark}>{t('field.notInList')}</span> : null}
          <ChevronsUpDown size={variant === 'node' ? 12 : 14} aria-hidden="true" className={styles.chevron} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        className={cx(styles.popover, modelField && styles.popoverWide, 'nowheel')}
        align="start"
        onOpenAutoFocus={(event) => {
          // Focus the filter when there is one, else the list, so arrows and Enter work at once.
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>('input, [role="listbox"]')?.focus();
        }}
        onKeyDown={onKeyDown}
      >
        {searchable ? (
          <input
            className={styles.filter}
            type="search"
            value={query}
            placeholder={String(t('field.search'))}
            aria-label={String(t('field.search'))}
            aria-controls={listId}
            aria-activedescendant={activeId}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
          />
        ) : null}
        {modelField ? (
          <ModelList
            listId={listId}
            listRef={listRef}
            state={models}
            shown={shown}
            fallback={options}
            current={text}
            directory={spec?.modelDirectory}
            active={active}
            name={name}
            onHover={setActive}
            onChoose={choose}
          />
        ) : (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={searchable ? -1 : 0}
            aria-label={name}
            aria-activedescendant={searchable ? undefined : activeId}
            className={styles.list}
          >
            {shown.length === 0 ? <li className={styles.empty}>{t('field.noMatch')}</li> : shown.map((option, index) => (
              <li
                key={option}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={option === text}
                className={cx(styles.option, index === active && styles.optionActive)}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span className={styles.optionText}>{option}</span>
                {option === text ? <Check size={14} aria-hidden="true" className={styles.check} /> : null}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </PopoverRoot>
  );
}

function NumberControl({ name, value, spec, variant, disabled, labelledBy, onCommit, kind }: FieldControlProps & { kind: 'int' | 'float' }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(displayValue(value));
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing) setDraft(displayValue(value));
  }, [value, editing]);
  const unset = isUnset(value);
  const commit = (raw: string) => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') {
      setDraft(displayValue(value));
      return;
    }
    const next = clampToSpec(Number(trimmed), spec, kind);
    if (next === null) {
      setDraft(displayValue(value));
      return;
    }
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  const step = (direction: 1 | -1) => {
    const next = stepValue(value, direction, spec, kind);
    if (next !== null && next !== value) onCommit(next);
  };
  const seed = isSeedField(name, spec) && kind === 'int';
  const compact = variant === 'node';
  const atMin = typeof value === 'number' && spec?.min !== undefined && value <= spec.min;
  const atMax = typeof value === 'number' && spec?.max !== undefined && value >= spec.max;
  return (
    <div className={styles.numberRow}>
      <div className={styles.stepper}>
        <button type="button" className={styles.stepButton} aria-label={String(t('field.decrease', { name }))} disabled={disabled || atMin} onClick={() => step(-1)}>
          <Minus size={compact ? 11 : 14} aria-hidden="true" />
        </button>
        <input
          className={styles.number}
          type="text"
          inputMode={kind === 'int' ? 'numeric' : 'decimal'}
          role="spinbutton"
          aria-valuenow={typeof value === 'number' ? value : undefined}
          aria-valuemin={spec?.min}
          aria-valuemax={spec?.max}
          spellCheck={false}
          value={draft}
          placeholder={unset ? String(t('field.unset')) : undefined}
          disabled={disabled}
          {...nameProps({ labelledBy, name })}
          onFocus={() => setEditing(true)}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit((event.target as HTMLInputElement).value);
            } else if (event.key === 'Escape') {
              cancelled.current = true;
              setDraft(displayValue(value));
              (event.target as HTMLInputElement).blur();
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              step(event.key === 'ArrowUp' ? 1 : -1);
            }
          }}
        />
        <button type="button" className={styles.stepButton} aria-label={String(t('field.increase', { name }))} disabled={disabled || atMax} onClick={() => step(1)}>
          <Plus size={compact ? 11 : 14} aria-hidden="true" />
        </button>
      </div>
      {seed ? (
        <button
          type="button"
          className={cx(styles.seed, compact && styles.seedIcon)}
          aria-label={String(t('field.randomLabel', { name }))}
          title={String(t('field.randomLabel', { name }))}
          disabled={disabled}
          onClick={() => onCommit(randomSeed(spec))}
        >
          <Dices size={compact ? 12 : 14} aria-hidden="true" />
          {compact ? null : <span>{t('field.random')}</span>}
        </button>
      ) : null}
    </div>
  );
}

function BooleanControl({ name, value, disabled, labelledBy, onCommit }: FieldControlProps) {
  const { t } = useTranslation();
  const checked = value === true;
  return (
    <span className={styles.switchRow}>
      <S.Root
        className={styles.switch}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCommit(next)}
        {...nameProps({ labelledBy, name })}
      >
        <S.Thumb className={styles.thumb} />
      </S.Root>
      <span className={cx(styles.switchText, isUnset(value) && styles.unset)} aria-hidden="true">
        {isUnset(value) ? t('field.unset') : checked ? t('field.on') : t('field.off')}
      </span>
    </span>
  );
}

function TextControl({ name, value, disabled, labelledBy, onCommit, multiline, json = false }: FieldControlProps & { multiline: boolean; json?: boolean }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(displayValue(value));
  const [editing, setEditing] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => {
    if (!editing) setDraft(displayValue(value));
  }, [value, editing]);
  const commit = (raw: string) => {
    setEditing(false);
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    let next: unknown = raw;
    if (json) {
      try {
        next = JSON.parse(raw);
      } catch {
        setDraft(displayValue(value));
        return;
      }
    }
    if (JSON.stringify(next) === JSON.stringify(value)) return;
    if (isUnset(value) && raw === '') return;
    onCommit(next);
  };
  const shared = {
    className: cx(multiline ? styles.textarea : styles.text),
    value: draft,
    disabled,
    // Prompts are tag lists ("35mm, bokeh"): spelling marks would underline half of them.
    spellCheck: false,
    placeholder: isUnset(value) ? String(t('field.unset')) : undefined,
    ...nameProps({ labelledBy, name }),
    onFocus: () => setEditing(true),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => commit(event.target.value),
  };
  if (multiline) {
    return (
      <textarea
        {...shared}
        rows={2}
        onKeyDown={(event) => {
          // Enter is a new line in a prompt; Ctrl/Cmd+Enter keeps it, Escape drops the draft.
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            commit((event.target as HTMLTextAreaElement).value);
          } else if (event.key === 'Escape') {
            cancelled.current = true;
            setDraft(displayValue(value));
            (event.target as HTMLTextAreaElement).blur();
          }
        }}
      />
    );
  }
  return (
    <input
      {...shared}
      type="text"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit((event.target as HTMLInputElement).value);
        } else if (event.key === 'Escape') {
          cancelled.current = true;
          setDraft(displayValue(value));
          (event.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
