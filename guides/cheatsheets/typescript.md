# TypeScript — Fiche ClockOut

| | Back (`back/`) | Front (`front/`) |
|---|---|---|
| **TypeScript** | `^6.0.2` | `~6.0.2` |
| **Modules** | ESM `nodenext` (`"type": "module"`) | `preserve` (bundler Angular) |
| **Target** | `ES2023` | `ES2022` |
| **`strict`** | `true` (déclaré) | `true` (**implicite**, défaut TS 6.0) |

**Légende chemins :** **B** = `back/src/` · **F** = `front/src/app/`

---

## 1. Le Top 5 essentiel

| # | Règle | Pourquoi | Dans ClockOut |
|---|-------|----------|---------------|
| 1 | **Union littérale**, pas d'`enum` | Zéro runtime, exhaustivité vérifiée | `SessionStatus` (B/F) |
| 2 | **`as const`** sur les constantes | Types étroits + `readonly` profond | `PERIOD_TYPE` |
| 3 | **Union discriminée** pour les états | Le discriminant restreint les champs | `SessionState` |
| 4 | **`unknown`**, jamais `any` | Force la vérification avant usage | `describeError(error: unknown)` |
| 5 | **`satisfies`** pour valider sans élargir | Contrôle la forme, garde le type exact | `ALLOWED_FROM` |

---

## 2. Tableau de syntaxe

| Fonctionnalité | Syntaxe / Exemple | Description rapide | Où |
|----------------|-------------------|--------------------|----|
| **`as const`** | `{ WORK: 1, BREAK: 2 } as const` | Littéraux + `readonly` profond | B `time-tracking/period-types.ts` |
| **Type depuis valeur** | `typeof PERIOD_TYPE.BREAK` | Type d'une valeur existante | F `time-tracking/sub-types.ts` |
| **Type indexé** | `(typeof ARR)[number]` | Union des éléments d'un tuple `as const` | B `time-tracking/period-types.ts` |
| **`satisfies`** | `expr satisfies Record<K, V>` | Valide `T`, conserve le type inféré | B `time-tracking/session-transitions.ts` |
| **`Record<Union, V>`** | `Record<ViolationCode, string>` | Une entrée obligatoire par membre | F `time-tracking/violation-messages.ts` |
| **`Extract<U, M>`** | `Extract<SessionState, { status: 'x' }>` | Filtre une union par forme | B `time-tracking/session-transitions.ts` |
| **Générique contraint** | `<A extends SessionAction>` | Lie l'argument au type de retour/assertion | B `time-tracking/session-transitions.ts` |
| **Assertion de type** | `asserts state is T` | Réduit le type après l'appel (sinon throw) | B `time-tracking/session-transitions.ts` |
| **Type guard** | `(v: string): v is CalendarDate` | Prédicat de réduction | B `time-tracking/week-rules.ts` |
| **Narrowing `in`** | `'report' in outcome` | Réduit une union sans discriminant | F `results-page/results-page.ts` |
| **`instanceof` sur `unknown`** | `error instanceof HttpErrorResponse` | Réduit `unknown` → classe | F `time-tracking/describe-error.ts` |
| **Classe abstraite = token** | `abstract class Clock { abstract now(): Date }` | Existe au runtime, donc injectable | B `time-tracking/clock.ts` |
| **Signal typé** | `signal<Violation[]>([])` | Générique requis si l'initial est trop étroit | F `session-dialog/session-dialog.ts` |
| **`inject<T>(token)`** | `inject<MatDialogRef<SessionDialog, boolean>>(MatDialogRef)` | Générique explicite : fixe les paramètres d'une classe générique (`MatDialogRef`) ou type un `InjectionToken` (`MAT_DIALOG_DATA`) | F `session-dialog/session-dialog.ts` |
| **`input` / `output`** | `input.required<number>()` · `output<number>()` | Contrat typé du composant | F `weekly-target-form/weekly-target-form.ts` |
| **Formulaire typé** | `FormGroup<{ start: FormControl<string> }>` | `getRawValue()` conserve les types | F `session-form/session-form.ts` |
| **`import type`** | `import type { SubPeriodTypeId } from '…'` | Import effacé (voir §4 pour les décorateurs) | B `time-tracking/dto/session-input.dto.ts` |

**Unions : syntaxe de référence**

```ts
type SessionStatus = 'none' | 'period' | 'subed';                 // littérale
type SessionState =                                               // discriminée
    | { status: 'none' }
    | { status: 'period'; session: Span; subs: SubSpan[] }
    | { status: 'subed'; session: Span; subs: SubSpan[]; sub: SubSpan };
```

---

## 3. Patterns ClockOut

### 3.1 Union discriminée — `back/src/time-tracking/session-state.ts`

```ts
function f(s: SessionState) {
    if (s.status === 'subed') s.sub;   // OK : s est restreint
    // s.sub                            // ERREUR TS2339 : absent de 'none'
}
```

### 3.2 Table de transitions typée — `…/session-transitions.ts`

```ts
export const ALLOWED_FROM = {
    start:  ['none'],
    sub:    ['period'],
    endsub: ['subed'],
    end:    ['period', 'subed']
} as const satisfies Record<SessionAction, readonly SessionStatus[]>;
```

- **`as const`** : conserve `['none']`, pas `string[]`.
- **`satisfies`** : action manquante → `TS1360` ; statut inconnu → `TS2322`.

### 3.3 Assertion générique — `…/session-transitions.ts`

```ts
type AllowedState<A extends SessionAction> = Extract<
    SessionState,
    { status: (typeof ALLOWED_FROM)[A][number] }
>;

export function assertTransition<A extends SessionAction>(
    state: SessionState, action: A
): asserts state is AllowedState<A> {
    const allowed: readonly SessionStatus[] = ALLOWED_FROM[action];  // élargit le tuple
    if (!allowed.includes(state.status))
        throw new InvalidTransitionError(action, state.status);
}

assertTransition(state, 'endsub');
state.sub;                             // OK : state est 'subed'
```

- **Annotation `readonly SessionStatus[]`** : sans elle, `.includes()` échoue en `TS2345` (paramètre inféré `never`).

### 3.4 Constantes → types dérivés — `…/period-types.ts`

```ts
export const PERIOD_TYPE = { WORK: 1, BREAK: 2, SCOUTING: 3 } as const;
export const SUB_PERIOD_TYPES = [PERIOD_TYPE.BREAK, PERIOD_TYPE.SCOUTING] as const;
export type SubPeriodTypeId = (typeof SUB_PERIOD_TYPES)[number];      // 2 | 3
export const SUBTRACTED_TYPES: readonly number[] = [PERIOD_TYPE.BREAK];
```

- **`@IsIn(SUB_PERIOD_TYPES)`** valide à l'exécution ce que `SubPeriodTypeId` garantit à la compilation.
- **`SUBTRACTED_TYPES`** volontairement **`readonly number[]`** : permet `.includes(n: number)`.

### 3.5 Contrôle d'une erreur `unknown` — `…/is-unique-violation.ts`

```ts
export const isUniqueViolation = (error: unknown): boolean =>
    error instanceof QueryFailedError
    && (error.driverError as { code?: string } | undefined)?.code === '23505';
```

- **Retourne `boolean`**, pas un prédicat `error is …` : aucune réduction de type chez l'appelant.

### 3.6 Classe abstraite comme token — `…/clock.ts`

```ts
export abstract class Clock { abstract now(): Date; }

@Injectable()
export class SystemClock extends Clock { now() { return new Date(); } }
```

- **Une `interface`** est effacée : inutilisable comme token Nest.

### 3.7 Union sans discriminant — `results-page/results-page.ts` (front)

```ts
type Outcome = { report: WeeklyReport } | { error: unknown };

map((report): Outcome => ({ report })),
catchError((error) => of<Outcome>({ error })),
// …
if ('report' in outcome) { outcome.report }   // réduit à { report }
```

- **`: Outcome` et `of<Outcome>`** : lisibilité, le type de l'union est explicite à chaque branche.

### 3.8 `switch` exhaustif sans `default` — `today-page/today-page.ts` (front)

```ts
switch (this.status()) {
    case 'none':   return 'Aucune session';
    case 'period': return 'Travail';
    case 'subed':  return this.currentSubType()?.statusLabel ?? 'En pause';
}
```

- **`noImplicitReturns`** casse la compilation si un statut est ajouté et non traité.
- **Variante générique** (absente du repo) : `default: assertNever(state)` avec `function assertNever(x: never): never { throw new Error(String(x)); }`.

---

## 4. Cas particuliers / Astuces de pro

| Sujet | Règle |
|-------|-------|
| **Imports ESM back** | **Extension `.js` obligatoire** : `from './session-state.js'` (même pour un `.ts`) |
| **`satisfies` vs `: T`** | `: T` **élargit** au type annoté · `satisfies T` **conserve** le type inféré |
| **`MESSAGES: Record<…>` (front)** | Annoté avec `:` (pas `satisfies`) : la valeur n'a pas besoin d'être plus étroite que `Record` |
| **`MESSAGES[code] ?? message`** | Le `Record` promet « jamais `undefined` », le serveur peut envoyer un code inconnu : **le `??` reste utile** |
| **Types effacés** | Aucune validation à l'exécution : `class-validator` sur les DTO, `instanceof`/guards ailleurs |
| **`as` = dette** | `sub.periodTypeId as SubTypeId` (`number` → union) `getRawValue() as SessionFormValue` et `hours as number` après `as { hours: unknown }` (`weekly-target-form.ts`) : **assertions non vérifiées** |
| **`SessionStatus` dupliqué** | B `session-state.ts` et F `session.model.ts` : modifier les deux |
| **`noUncheckedIndexedAccess`** | **Non activé** (B et F) : `arr[0].x` ne lève pas `TS18048` ; le `??` de repli n'est pas vérifié par tsc |
| **Constantes dupliquées** | `PERIOD_TYPE` existe en **B** `time-tracking/period-types.ts` **et** F `time-tracking/sub-types.ts` : modifier les deux |
| **Alias non branded** | `CalendarDate = string` : **aucune protection** de type |
| **Guard sur alias de `string`** | `v is CalendarDate` = `v is string` → branche négative réduite à **`never`** (`x.length` → `TS2339`) |
| **Brand (vraie protection)** | `type CalendarDate = string & { readonly __brand: 'CalendarDate' }` |
| **Dates : 3 représentations (front)** | ISO `string` sur le fil · `string` `datetime-local` dans le formulaire · **`Date`** dans le brouillon métier (`session-rules.ts`) |
| **Dates : 2 représentations (back)** | `string` ISO dans les DTO · `Date` dans `SessionInput` (`toSessionInput`) |
| **`new Date(str)` silencieux** | Sous V8 (Node 24) : `'2026-02-31'` → `03-03`, sans erreur |
| **Valider avant `new Date`** | `isCalendarDate` (B) avant toute construction |
| **`Date` invalide** | `Number.isNaN(date.getTime())` (voir `fromLocalInput`) |
| **Index signature (front)** | `this.form.errors?.['rules']` : `ValidationErrors` est indexé **et** `noPropertyAccessFromIndexSignature` est actif → crochets obligatoires (`TS4111`) |
| **`noFallthroughCasesInSwitch`** | Un `case` **non vide** doit finir par `break`, `return` ou `throw` |
| **`import type` + décorateurs (back)** | Obligatoire pour une **interface ou un alias** dans une signature décorée ; une **classe** garde l'import normal |
| **`types` (front)** | `[]` en app ; `["vitest/globals"]` en spec → `describe`/`vi` sans import |
| **`experimentalDecorators`** | Back : Nest + class-validator · Front : décorateurs Angular ; `emitDecoratorMetadata` **back uniquement** |

---

## 5. Dépannage / Erreurs courantes

| Erreur / Symptôme | Cause | Correctif |
|-------------------|-------|-----------|
| **`TS2835`** relative import needs explicit extension (back) | Extension `.js` manquante en `nodenext` | `'./x.js'` |
| **`TS2307`** Cannot find module | Fichier réellement introuvable | Chemin / nom |
| **`TS1272`** type in decorated signature | Interface ou alias importé sans `type` (+ `isolatedModules` + `emitDecoratorMetadata`) | `import type { T }` |
| **`TS2322`** `string` not assignable (union littérale) | Littéral élargi en `string` | `as const`, ou annoter le type union |
| **`TS2339`** property does not exist | Discriminant non testé (union) | `if (s.status === '…')` d'abord |
| **`TS2345`** `readonly […]` not assignable to mutable | Tuple `as const` passé à un `T[]` | Paramètre `readonly T[]` |
| **`TS2345`** argument not assignable to `never` sur `.includes()` | `.includes()` sur une union de tuples : le paramètre devient l'**intersection** des éléments (`never`) | `const a: readonly Status[] = …` |
| **`TS2540`** cannot assign, read-only | Mutation d'un objet `as const` | Ne pas muter |
| **`TS1360`** does not satisfy | Clé manquante (`satisfies Record<…>`) | Ajouter l'entrée |
| **`TS18048`** possibly `undefined` (`TS2532` pour une expression) | `strict` + valeur optionnelle | `?.`, `??`, ou garde |
| **`TS2564`** no initializer | `strictPropertyInitialization` actif (front) | Initialiser, `!`, ou `?` · back : désactivé |
| **`TS4114`** must have `override` (front) | `noImplicitOverride` | Ajouter `override` |
| **`TS4111`** from an index signature (front) | `noPropertyAccessFromIndexSignature` | `obj['key']` |
| **`TS7030`** not all code paths return (front) | `noImplicitReturns` | `return` explicite partout |
| **`TS7029`** fallthrough case in switch (front) | `case` non vide sans sortie | `break` / `return` / `throw` |
| **Nest « can't resolve dependencies of X (?) »** | Interface utilisée comme token (type émis : `Object`) | Classe abstraite ou `@Inject('TOKEN')` |
| **`tsc --noEmit` sort 0 sans rien vérifier (front)** | Racine : `"files": []` + `references` | `npx tsc -p tsconfig.app.json --noEmit` |
| **Build OK, runtime KO** | Types effacés | `class-validator`, guards, `??` de repli |

---

## 6. Annexe — Config et commandes

### 6.1 Options notables

| Option | Back | Front | Remarque |
|--------|:----:|:-----:|----------|
| **`strictPropertyInitialization`** | `false` | défaut (`true`) | Back : champs de DTO sans `!` |
| **`isolatedModules`** | `true` | `true` | Chaque fichier compilable seul |
| **`emitDecoratorMetadata`** | `true` | — | Types émis pour l'injection Nest |
| **`noImplicitOverride`** | — | `true` | `TS4114` |
| **`noPropertyAccessFromIndexSignature`** | — | `true` | `TS4111` |
| **`noImplicitReturns`** | — | `true` | `TS7030` |
| **`noFallthroughCasesInSwitch`** | — | `true` | `TS7029` |
| **`strictTemplates`** | — | *non déclaré* | Seuls `strictInjectionParameters` et `strictInputAccessModifiers` le sont |

- **Config front effective :** `tsconfig.app.json` (code) et `tsconfig.spec.json` (specs), tous deux `extends` `tsconfig.json`.
- **`--showConfig`** n'affiche **que les options explicites** (+ quelques dérivées, ex. `preserveConstEnums`) : jamais les défauts (`strict`, `useDefineForClassFields`).
- **Test de `strict` actif :** `function g(x?: string) { return x.length }` doit lever `TS18048`.

### 6.2 Commandes

| Où | Commande | Action |
|----|----------|--------|
| **`back/`** | `npx tsc --noEmit` | Type-check seul |
| **`front/`** | `npx tsc -p tsconfig.app.json --noEmit` | Type-check de l'app |
| **`front/`** | `npx tsc -p tsconfig.spec.json --noEmit` | Type-check des specs |
| **`front/`** | `npx tsc -p tsconfig.app.json --showConfig` | Options explicites résolues |
| **`back/`** | `npm run lint` | `oxlint --type-aware src/ test/` |
| **`back/`** | `npm run build` | `nest build` → `dist/` |
| **`front/`** | `ng build` · `ng test` | Build et tests (pas de script `lint`) |
