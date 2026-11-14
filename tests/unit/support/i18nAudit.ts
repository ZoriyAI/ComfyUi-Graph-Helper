import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

/**
 * A static check of every translated text in the app. Each call of a translation function is read from the
 * source with the TypeScript type checker, its key is looked up in the catalog, and the values the text needs
 * ({{done}}, {{count}}, …) are compared with what the call passes. A text shown without its values prints the
 * placeholder itself on screen ("Reading model metadata: {{done}} / {{total}}"), and a key that is not in the
 * catalog prints the key.
 *
 * A key that is not written at the call is followed to where it is written:
 * - a union of literals (`'ask' | 'build'`), also inside a template (`menu.${group}`), gives exact keys;
 * - a variable gives its initializer and every assignment to it;
 * - a property (`view.labelKey`, `command.labelKey`) gives every value written to that same property of that
 *   same type anywhere in the app, so a status label is not confused with a command label;
 * - a table lookup gives every string in the table, a function call every string the function returns.
 * When any text the key can be needs values, the call must pass values. A key this check cannot follow is
 * reported too, so nothing is assumed safe by silence.
 */

export interface AuditFinding {
  kind: 'unknown-key' | 'missing-values' | 'dynamic-needs-values' | 'empty-value' | 'unresolved';
  file: string;
  line: number;
  code: string;
  detail: string;
}

/** Names a translation function is called by. Wrappers that pass their own parameter on are found by themselves. */
const CALLEES = new Set(['t', 'translate', 'tr']);
const PLURAL = /_(zero|one|two|few|many|other)$/;
const MAX_KEYS = 400;

function leaves(value: unknown, prefix = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[prefix, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key));
}

export function placeholdersOf(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*(?:,[^}]*)?\}\}/g)) names.add(match[1]);
  return [...names];
}

export class Catalog {
  private readonly texts = new Map<string, string[]>();

  constructor(catalogs: unknown[]) {
    for (const catalog of catalogs) {
      for (const [key, text] of leaves(catalog)) {
        // A plural text is asked for by its base key; its forms may name different values.
        for (const name of new Set([key, key.replace(PLURAL, '')])) {
          const list = this.texts.get(name) ?? [];
          list.push(text);
          this.texts.set(name, list);
        }
      }
    }
  }

  has(key: string): boolean {
    return this.texts.has(key);
  }

  /** Every value name any language's text for this key uses. */
  needs(key: string): string[] {
    return [...new Set((this.texts.get(key) ?? []).flatMap(placeholdersOf))];
  }

  matching(pattern: RegExp): string[] {
    return [...this.texts.keys()].filter((key) => pattern.test(key));
  }
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full);
    }
  };
  walk(root);
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** What an expression can be as a key: exact keys, key patterns (templates), and whether part of it is unknown. */
interface KeySet {
  keys: Set<string>;
  patterns: RegExp[];
  open: boolean;
  /** Where the trail went cold, for the report. */
  why?: string;
}

function emptySet(): KeySet {
  return { keys: new Set(), patterns: [], open: false };
}

function merge(target: KeySet, source: KeySet): void {
  for (const key of source.keys) target.keys.add(key);
  target.patterns.push(...source.patterns);
  target.open = target.open || source.open;
  target.why = target.why ?? source.why;
}

function where(node: ts.Node): string {
  const source = node.getSourceFile();
  const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  return `${path.basename(source.fileName)}:${line} ${node.getText(source).replace(/\s+/g, ' ').slice(0, 80)}`;
}

function lost(set: KeySet, reason: string): void {
  set.open = true;
  set.why = set.why ?? reason;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isNonNullExpression(current) || ts.isSatisfiesExpression(current)) {
    current = current.expression;
  }
  return current;
}

function isFunctionLike(node: ts.Node): node is ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | ts.MethodDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node);
}

export interface AuditStats {
  /** Translation calls read. */
  calls: number;
  /** Calls whose key is not written at the call and was followed to where it is written. */
  followed: number;
}

export function auditTranslations(
  root: string,
  catalogs: unknown[],
  skip: (file: string) => boolean = () => false,
  stats: AuditStats = { calls: 0, followed: 0 },
): AuditFinding[] {
  const catalog = new Catalog(catalogs);
  const files = sourceFiles(root);
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true,
    skipLibCheck: true,
    noEmit: true,
    lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
    types: ['node', 'vite/client'],
  });
  const checker = program.getTypeChecker();
  const sources = program.getSourceFiles().filter((source) => !source.isDeclarationFile && source.fileName.startsWith(root));

  // Where values are written: to a variable (by its symbol) and to a property (by the symbol of the property
  // as its type declares it, so the same field of the same interface collects every object written as that type).
  const writes = new Map<ts.Symbol, ts.Expression[]>();
  const remember = (symbol: ts.Symbol | undefined, value: ts.Expression) => {
    if (!symbol) return;
    const list = writes.get(symbol) ?? [];
    list.push(value);
    writes.set(symbol, list);
  };
  // Every object written with a property of a given name. An object that was not typed where it was written
  // (built in a callback, returned from a function) still counts as a write to an interface's field when its
  // shape fits that interface.
  const literalsByProperty = new Map<string, Array<{ literal: ts.ObjectLiteralExpression; value: ts.Expression }>>();
  const propertyOf = (literal: ts.ObjectLiteralExpression, name: string): ts.Symbol | undefined => {
    const contextual = checker.getContextualType(literal);
    const fromContext = contextual?.getProperty(name);
    if (fromContext) return fromContext;
    return checker.getTypeAtLocation(literal).getProperty(name);
  };
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))) {
        remember(propertyOf(node.parent, node.name.text), node.initializer);
        literalsByProperty.set(node.name.text, [...(literalsByProperty.get(node.name.text) ?? []), { literal: node.parent, value: node.initializer }]);
      } else if (ts.isShorthandPropertyAssignment(node) && ts.isObjectLiteralExpression(node.parent)) {
        remember(propertyOf(node.parent, node.name.text), node.name);
        literalsByProperty.set(node.name.text, [...(literalsByProperty.get(node.name.text) ?? []), { literal: node.parent, value: node.name }]);
      } else if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.initializer) {
        // `<ToolButton shortKey="toolbar.openShort" />` writes the component's `shortKey` prop.
        const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
        if (value) {
          // The prop as the component declares it, so the read inside the component finds this write.
          const declared = checker.getContextualType(node.parent)?.getProperty(node.name.text);
          remember(declared ?? checker.getSymbolAtLocation(node.name), value as ts.Expression);
        }
      } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const left = unwrap(node.left);
        if (ts.isIdentifier(left)) remember(checker.getSymbolAtLocation(left), node.right);
        else if (ts.isPropertyAccessExpression(left)) remember(checker.getSymbolAtLocation(left.name), node.right);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // Every call, by the function it calls: a key that arrives as an argument is followed to what callers pass.
  const callsOf = new Map<ts.Symbol, ts.CallExpression[]>();
  const resolved = (symbol: ts.Symbol | undefined): ts.Symbol | undefined => (symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol);
  for (const source of sources) {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = unwrap(node.expression);
        const symbol = resolved(ts.isIdentifier(callee) ? checker.getSymbolAtLocation(callee) : ts.isPropertyAccessExpression(callee) ? checker.getSymbolAtLocation(callee.name) : undefined);
        if (symbol) callsOf.set(symbol, [...(callsOf.get(symbol) ?? []), node]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  /** The symbol a function is known by: its own name, or the variable or property it is bound to. */
  const functionSymbol = (owner: ts.Node): ts.Symbol | undefined => {
    if ((ts.isFunctionDeclaration(owner) || ts.isMethodDeclaration(owner)) && owner.name) return resolved(checker.getSymbolAtLocation(owner.name));
    const holder = owner.parent;
    if (holder && (ts.isVariableDeclaration(holder) || ts.isPropertyAssignment(holder) || ts.isPropertyDeclaration(holder))) return resolved(checker.getSymbolAtLocation(holder.name));
    return undefined;
  };

  const followed = new Map<ts.Symbol, KeySet>();
  const resolving = new Set<ts.Symbol>();

  /** Exact strings when the checker knows the expression as a literal or a union of literals. */
  const literalsOf = (node: ts.Expression): string[] | null => {
    const type = checker.getTypeAtLocation(node);
    const parts = type.isUnion() ? type.types : [type];
    const out: string[] = [];
    for (const part of parts) {
      if (part.isStringLiteral()) out.push(part.value);
      else if (part.flags & ts.TypeFlags.Undefined || part.flags & ts.TypeFlags.Null) continue;
      else return null;
    }
    return out.length > 0 ? out : null;
  };

  const followSymbol = (symbol: ts.Symbol | undefined, out: KeySet, depth: number): void => {
    if (!symbol) {
      lost(out, 'a name with no symbol');
      return;
    }
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    const known = followed.get(target);
    if (known) {
      merge(out, known);
      return;
    }
    // A value that leads back to itself adds nothing new.
    if (resolving.has(target)) return;
    resolving.add(target);
    const found = emptySet();
    let sites = 0;
    for (const declaration of target.declarations ?? []) {
      if ((ts.isVariableDeclaration(declaration) || ts.isParameter(declaration) || ts.isPropertyDeclaration(declaration)) && declaration.initializer) {
        merge(found, keysOf(declaration.initializer, depth + 1));
        sites += 1;
      }
      if (ts.isParameter(declaration) && isFunctionLike(declaration.parent)) {
        // A key received as an argument: what every caller of that function passes in that place.
        const owner = declaration.parent;
        const index = owner.parameters.indexOf(declaration);
        const calls = callsOf.get(functionSymbol(owner) ?? target) ?? [];
        for (const call of calls) {
          const argument = call.arguments[index];
          if (argument && !ts.isSpreadElement(argument)) merge(found, keysOf(argument, depth + 1));
        }
        if (functionSymbol(owner) && calls.length > 0) sites += 1;
      } else if (ts.isPropertyAssignment(declaration)) {
        merge(found, keysOf(declaration.initializer, depth + 1));
        sites += 1;
      } else if (ts.isShorthandPropertyAssignment(declaration)) {
        // `{ hintKey }`: the variable of that name.
        const value = checker.getShorthandAssignmentValueSymbol(declaration);
        if (value && value !== target) {
          followSymbol(value, found, depth + 1);
          sites += 1;
        }
      } else if (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) {
        // A field of an interface or a type: every object whose shape fits that type and that has the field.
        const owner = declaration.parent;
        const ownerType = ts.isInterfaceDeclaration(owner) || ts.isTypeLiteralNode(owner) || ts.isClassDeclaration(owner) ? checker.getTypeAtLocation(owner) : undefined;
        if (ownerType) {
          for (const candidate of literalsByProperty.get(target.name) ?? []) {
            const shape = checker.getTypeAtLocation(candidate.literal);
            if (!checker.isTypeAssignableTo(shape, ownerType)) continue;
            merge(found, keysOf(candidate.value, depth + 1));
            sites += 1;
          }
        }
      } else if (ts.isBindingElement(declaration)) {
        // `const { labelKey } = view`: the property of the same name on the value being taken apart.
        const pattern = declaration.parent;
        const holder = pattern.parent;
        const name = declaration.propertyName ?? declaration.name;
        if (ts.isObjectBindingPattern(pattern) && (ts.isVariableDeclaration(holder) || ts.isParameter(holder)) && ts.isIdentifier(name)) {
          const from = holder.initializer ? checker.getTypeAtLocation(holder.initializer) : checker.getTypeAtLocation(holder);
          const property = from.getProperty(name.text);
          if (property && property !== target) {
            followSymbol(property, found, depth + 1);
            sites += 1;
          }
        }
      }
    }
    for (const value of writes.get(target) ?? []) {
      merge(found, keysOf(value, depth + 1));
      sites += 1;
    }
    if (sites === 0) {
      const declared = target.declarations?.[0];
      lost(found, `nothing is written to "${target.name}"${declared ? ` (${where(declared)})` : ''}`);
    }
    resolving.delete(target);
    followed.set(target, found);
    merge(out, found);
  };

  const returnsOf = (node: ts.Node, depth: number): KeySet => {
    const out = emptySet();
    if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && !ts.isBlock(node.body)) {
      merge(out, keysOf(node.body as ts.Expression, depth));
      return out;
    }
    let returns = 0;
    const visit = (child: ts.Node) => {
      // A nested function's returns are its own.
      if (child !== node && isFunctionLike(child)) return;
      if (ts.isReturnStatement(child) && child.expression) {
        merge(out, keysOf(child.expression, depth));
        returns += 1;
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    if (returns === 0) lost(out, `a function without a return: ${where(node)}`);
    return out;
  };

  /** Every string a table holds, at any depth (a table of objects with a `labelKey` each is read through). */
  const stringsIn = (node: ts.Node, depth: number, only?: string): KeySet => {
    const out = emptySet();
    let found = 0;
    const visit = (child: ts.Node) => {
      if (ts.isPropertyAssignment(child)) {
        const value = unwrap(child.initializer);
        if (ts.isObjectLiteralExpression(value) || ts.isArrayLiteralExpression(value)) {
          visit(value);
          return;
        }
        const name = ts.isIdentifier(child.name) || ts.isStringLiteral(child.name) ? child.name.text : '';
        if (!only || name === only) {
          merge(out, keysOf(child.initializer, depth));
          found += 1;
        }
        return;
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    if (found === 0) lost(out, `a table without strings: ${where(node)}`);
    return out;
  };

  function keysOf(input: ts.Expression, depth = 0): KeySet {
    const node = unwrap(input);
    const out = emptySet();
    if (depth > 12) {
      lost(out, `too deep at ${where(node)}`);
      return out;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.keys.add(node.text);
      return out;
    }
    // "No text here": the call is guarded by the code around it.
    if (node.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(node) && node.text === 'undefined')) return out;
    if (ts.isConditionalExpression(node)) {
      merge(out, keysOf(node.whenTrue, depth + 1));
      merge(out, keysOf(node.whenFalse, depth + 1));
      return out;
    }
    if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
      merge(out, keysOf(node.left, depth + 1));
      merge(out, keysOf(node.right, depth + 1));
      return out;
    }
    const exact = literalsOf(node);
    if (exact) {
      for (const key of exact) out.keys.add(key);
      return out;
    }
    if (ts.isTemplateExpression(node)) {
      // `menu.${group}` with group a union of literals is a finite list of keys; otherwise a pattern.
      let texts: string[] | null = [node.head.text];
      for (const span of node.templateSpans) {
        const values: string[] | null = texts ? literalsOf(span.expression) : null;
        if (!texts || !values || texts.length * values.length > MAX_KEYS) {
          texts = null;
          break;
        }
        texts = texts.flatMap((prefix) => values.map((value) => `${prefix}${value}${span.literal.text}`));
      }
      if (texts) {
        for (const key of texts) out.keys.add(key);
      } else {
        const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)];
        out.patterns.push(new RegExp(`^${parts.map(escapeRegExp).join('[A-Za-z0-9_-]+')}$`));
      }
      return out;
    }
    if (ts.isIdentifier(node)) {
      followSymbol(checker.getSymbolAtLocation(node), out, depth);
      return out;
    }
    if (ts.isPropertyAccessExpression(node)) {
      followSymbol(checker.getSymbolAtLocation(node.name), out, depth);
      return out;
    }
    if (ts.isElementAccessExpression(node)) {
      // A key picked from a table: every string in that table.
      const table = unwrap(node.expression);
      const symbol = ts.isIdentifier(table) ? checker.getSymbolAtLocation(table) : ts.isPropertyAccessExpression(table) ? checker.getSymbolAtLocation(table.name) : undefined;
      const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      let read = false;
      for (const declaration of target?.declarations ?? []) {
        if ((ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) && declaration.initializer) {
          merge(out, stringsIn(declaration.initializer, depth + 1));
          read = true;
        }
      }
      if (!read) lost(out, `a table this check cannot read: ${where(node)}`);
      return out;
    }
    if (ts.isCallExpression(node)) {
      // A key returned by a function: every string it can return.
      const callee = unwrap(node.expression);
      const symbol = ts.isIdentifier(callee) ? checker.getSymbolAtLocation(callee) : ts.isPropertyAccessExpression(callee) ? checker.getSymbolAtLocation(callee.name) : undefined;
      const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      let read = false;
      for (const declaration of target?.declarations ?? []) {
        if (isFunctionLike(declaration)) {
          merge(out, returnsOf(declaration, depth + 1));
          read = true;
        } else if (ts.isVariableDeclaration(declaration) && declaration.initializer && isFunctionLike(declaration.initializer)) {
          merge(out, returnsOf(declaration.initializer, depth + 1));
          read = true;
        }
      }
      if (!read) lost(out, `a function this check cannot read: ${where(node)}`);
      return out;
    }
    lost(out, `an expression this check cannot read: ${where(node)}`);
    return out;
  }

  // Translation callees: the names above, plus every function that hands its own parameter to one as the key
  // ("const tr = (key, values) => String(i18n.t(key, values))"). Calls to those are checked like `t` itself, and
  // the call inside the wrapper is not a place where a key is chosen.
  const wrappers = new Set<ts.Symbol>();
  const passThrough = new Set<ts.CallExpression>();
  const isCallee = (callee: ts.Expression): boolean => {
    if (ts.isIdentifier(callee)) {
      if (CALLEES.has(callee.text)) return true;
      const symbol = checker.getSymbolAtLocation(callee);
      const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
      return Boolean(target && wrappers.has(target));
    }
    if (ts.isPropertyAccessExpression(callee)) {
      if (callee.name.text === 't') return true;
      const symbol = checker.getSymbolAtLocation(callee.name);
      return Boolean(symbol && wrappers.has(symbol));
    }
    return false;
  };
  const enclosingFunction = (node: ts.Node): ts.Node | undefined => {
    let current: ts.Node | undefined = node.parent;
    while (current && !isFunctionLike(current)) current = current.parent;
    return current;
  };
  for (let round = 0; round < 4; round += 1) {
    let grew = false;
    for (const source of sources) {
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && node.arguments.length > 0 && isCallee(node.expression)) {
          const first = unwrap(node.arguments[0]);
          const symbol = ts.isIdentifier(first) ? checker.getSymbolAtLocation(first) : undefined;
          const parameter = symbol?.declarations?.find(ts.isParameter);
          const owner = parameter ? enclosingFunction(node) : undefined;
          // A wrapper takes the key first, as `t` does; a key that arrives as some later argument of a larger
          // function is not followed and is reported.
          if (parameter && owner && parameter.parent === owner && isFunctionLike(owner) && owner.parameters[0] === parameter) {
            passThrough.add(node);
            // The wrapper is known by the name it is bound to.
            const named = ts.isFunctionDeclaration(owner) || ts.isMethodDeclaration(owner) ? owner.name : ts.isVariableDeclaration(owner.parent) ? owner.parent.name : ts.isPropertyAssignment(owner.parent) ? owner.parent.name : undefined;
            const wrapper = named ? checker.getSymbolAtLocation(named) : undefined;
            if (wrapper && !wrappers.has(wrapper)) {
              wrappers.add(wrapper);
              grew = true;
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }
    if (!grew) break;
  }

  const findings: AuditFinding[] = [];
  const looksLikeKey = (key: string) => /^[a-zA-Z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/.test(key);

  const check = (call: ts.CallExpression, source: ts.SourceFile): void => {
    const file = path.relative(root, source.fileName);
    const line = source.getLineAndCharacterOfPosition(call.getStart()).line + 1;
    const code = call.getText(source).replace(/\s+/g, ' ').slice(0, 170);
    const first = unwrap(call.arguments[0]);
    const written = ts.isStringLiteral(first) || ts.isNoSubstitutionTemplateLiteral(first);
    stats.calls += 1;
    if (!written) stats.followed += 1;
    const set = keysOf(first);
    for (const key of set.keys) {
      if (looksLikeKey(key) && !catalog.has(key)) findings.push({ kind: 'unknown-key', file, line, code, detail: `"${key}" is not in the catalog` });
    }
    const candidates = new Set<string>([...set.keys].filter((key) => catalog.has(key)));
    for (const pattern of set.patterns) {
      for (const key of catalog.matching(pattern)) candidates.add(key);
    }
    const needs = new Map<string, string[]>();
    for (const key of candidates) {
      const names = catalog.needs(key);
      if (names.length > 0) needs.set(key, names);
    }
    const second = call.arguments[1] ? unwrap(call.arguments[1]) : undefined;
    if (!second) {
      if (needs.size > 0) {
        const [key, names] = [...needs.entries()][0];
        findings.push({
          kind: written ? 'missing-values' : 'dynamic-needs-values',
          file, line, code,
          detail: `${written ? '' : 'the key can be '}"${key}", which needs ${names.map((name) => `{{${name}}}`).join(', ')}; no values are passed`,
        });
      } else if (set.open) {
        findings.push({ kind: 'unresolved', file, line, code, detail: `the key cannot be followed: ${set.why ?? 'unknown'}` });
      }
      return;
    }
    // The names the call passes: from an object written at the call, or from the type of what is passed.
    let passed: Set<string> | null = null;
    // A value written at the call that can be undefined or null prints as nothing ("Reading  / ").
    const maybeEmpty = new Map<string, string>();
    const canBeEmpty = (value: ts.Expression): boolean => {
      const type = checker.getTypeAtLocation(value);
      const parts = type.isUnion() ? type.types : [type];
      return parts.some((part) => Boolean(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
    };
    if (ts.isObjectLiteralExpression(second)) {
      passed = new Set<string>();
      for (const property of second.properties) {
        if (ts.isPropertyAssignment(property) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && canBeEmpty(property.initializer)) {
          maybeEmpty.set(property.name.text, property.initializer.getText(source).replace(/\s+/g, ' ').slice(0, 60));
        } else if (ts.isShorthandPropertyAssignment(property) && canBeEmpty(property.name)) {
          maybeEmpty.set(property.name.text, property.name.text);
        }
        if (ts.isSpreadAssignment(property)) {
          const spread = checker.getTypeAtLocation(property.expression);
          if (spread.getStringIndexType() || spread.flags & ts.TypeFlags.Any) passed = null;
          else for (const member of spread.getProperties()) passed?.add(member.name);
          if (!passed) break;
        } else if (property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) {
          passed.add(property.name.text);
        }
      }
    } else {
      const type = checker.getTypeAtLocation(second);
      const parts = type.isUnion() ? type.types.filter((part) => !(part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null))) : [type];
      // A values object with an open shape (Record<string, unknown>) cannot be read here; it is taken as complete.
      if (parts.length === 1 && !parts[0].getStringIndexType() && !(parts[0].flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) && parts[0].getProperties().length > 0) {
        passed = new Set(parts[0].getProperties().map((member) => member.name));
      }
    }
    if (!passed) return;
    for (const [key, names] of needs) {
      const missing = names.filter((name) => !passed.has(name));
      if (missing.length > 0) {
        findings.push({ kind: 'missing-values', file, line, code, detail: `"${key}" needs ${missing.map((name) => `{{${name}}}`).join(', ')}, which the call does not pass` });
        return;
      }
      const empty = names.filter((name) => maybeEmpty.has(name));
      if (empty.length > 0) {
        findings.push({ kind: 'empty-value', file, line, code, detail: `"${key}" uses {{${empty[0]}}}, and the value passed for it (${maybeEmpty.get(empty[0])}) can be undefined or null` });
        return;
      }
    }
  };

  for (const source of sources) {
    if (skip(source.fileName)) continue;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.arguments.length > 0 && isCallee(node.expression) && !passThrough.has(node)) check(node, source);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}
