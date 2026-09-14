import { randomUUID } from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';

type LocalResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quote(name: string): string {
  if (!IDENTIFIER.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
}

function failure(error: unknown): LocalResult {
  return {
    data: null,
    error: { message: error instanceof Error ? error.message : String(error) },
  };
}

// Bound as text and cast in SQL, so Postgres does the type conversion.
function toParam(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value as string | number | boolean);
}

/**
 * Local-development stand-in for the supabase-js client, for machines that
 * run plain Postgres with no Supabase REST (PostgREST) server in front of it.
 * It runs the same SQL functions from supabase/migrations and the few table
 * writes the backend makes through supabase-js, directly via Prisma.
 *
 * Only the call shapes the backend actually uses are supported: rpc(), and
 * from(table) with upsert(...).select().single(), delete().eq(...), and the
 * select/limit connectivity check. Enabled by SUPABASE_LOCAL_DIRECT=true and
 * never in production (see SupabaseService).
 */
export class LocalSupabaseClient {
  constructor(private readonly prisma: PrismaService) {}

  async rpc(
    fn: string,
    params: Record<string, unknown> = {},
  ): Promise<LocalResult> {
    try {
      const overloads = await this.prisma.$queryRawUnsafe<
        {
          names: string[] | null;
          types: string[];
          retset: boolean;
          ret: string;
        }[]
      >(
        `SELECT p.proargnames AS names,
                ARRAY(SELECT format_type(t, NULL) FROM unnest(p.proargtypes::oid[]) t) AS types,
                p.proretset AS retset,
                format_type(p.prorettype, NULL) AS ret
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        fn,
      );

      const keys = Object.keys(params).filter(
        (key) => params[key] !== undefined,
      );
      // proargnames also lists OUT/TABLE columns after the inputs.
      const candidates = overloads
        .map((o) => ({
          ...o,
          inputs: (o.names ?? []).slice(0, o.types.length),
        }))
        .filter((o) => keys.every((key) => o.inputs.includes(key)))
        // Prefer text over uuid overloads, as PostgREST does for string args.
        .sort(
          (a, b) =>
            a.types.filter((t) => t === 'uuid').length -
            b.types.filter((t) => t === 'uuid').length,
        );
      const target = candidates[0];
      if (!target) {
        return failure(
          `Could not find the function public.${fn} with arguments (${keys.join(', ')})`,
        );
      }

      const args = keys
        .map(
          (key, i) =>
            `${quote(key)} => $${i + 1}::${target.types[target.inputs.indexOf(key)]}`,
        )
        .join(', ');
      const values = keys.map((key) => toParam(params[key]));
      const call = `public.${quote(fn)}(${args})`;

      if (target.ret === 'void') {
        // $queryRaw can't deserialize a void column; execute ignores results.
        await this.prisma.$executeRawUnsafe(`SELECT ${call}`, ...values);
        return { data: null, error: null };
      }
      if (target.retset) {
        const rows = await this.prisma.$queryRawUnsafe<{ v: unknown }[]>(
          `SELECT to_jsonb(r) AS v FROM ${call} r`,
          ...values,
        );
        return { data: rows.map((row) => row.v), error: null };
      }
      const rows = await this.prisma.$queryRawUnsafe<{ v: unknown }[]>(
        `SELECT to_jsonb(${call}) AS v`,
        ...values,
      );
      return { data: rows[0]?.v ?? null, error: null };
    } catch (error) {
      return failure(error);
    }
  }

  from(table: string): LocalTableQuery {
    return new LocalTableQuery(this.prisma, table);
  }
}

class LocalTableQuery implements PromiseLike<LocalResult> {
  private mode: 'select' | 'upsert' | 'delete' = 'select';
  private rows: Record<string, unknown>[] = [];
  private conflict: string[] = [];
  private filters: [string, unknown][] = [];
  private wantSingle = false;
  private wantCount = false;
  private rowLimit: number | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly table: string,
  ) {}

  select(_columns = '*', options?: { head?: boolean; count?: string }) {
    if (options?.count) this.wantCount = true;
    return this;
  }

  limit(count: number) {
    this.rowLimit = count;
    return this;
  }

  upsert(
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ) {
    this.mode = 'upsert';
    this.rows = Array.isArray(rows) ? rows : [rows];
    this.conflict = (options?.onConflict ?? '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    return this;
  }

  delete() {
    this.mode = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  then<R1 = LocalResult, R2 = never>(
    onFulfilled?: ((value: LocalResult) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.execute().then(onFulfilled, onRejected);
  }

  private async columns() {
    const rows = await this.prisma.$queryRawUnsafe<
      { name: string; type: string; hasDefault: boolean }[]
    >(
      `SELECT attname AS name, format_type(atttypid, atttypmod) AS type, atthasdef AS "hasDefault"
         FROM pg_attribute
        WHERE attrelid = to_regclass($1) AND attnum > 0 AND NOT attisdropped`,
      `public.${quote(this.table)}`,
    );
    if (rows.length === 0) throw new Error(`Unknown table: ${this.table}`);
    return new Map(rows.map((row) => [row.name, row]));
  }

  private async execute(): Promise<LocalResult> {
    try {
      const table = `public.${quote(this.table)}`;

      if (this.mode === 'select') {
        const rows = await this.prisma.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM ${table}`,
        );
        return {
          data: null,
          error: null,
          count: this.wantCount ? (rows[0]?.n ?? 0) : null,
        };
      }

      const columns = await this.columns();
      const typeOf = (name: string) => {
        const column = columns.get(name);
        if (!column) throw new Error(`Unknown column ${this.table}.${name}`);
        return column.type;
      };

      if (this.mode === 'delete') {
        if (this.filters.length === 0) {
          throw new Error('Refusing to delete without a filter');
        }
        const where = this.filters
          .map(([col], i) => `${quote(col)} = $${i + 1}::${typeOf(col)}`)
          .join(' AND ');
        await this.prisma.$queryRawUnsafe(
          `DELETE FROM ${table} WHERE ${where}`,
          ...this.filters.map(([, value]) => toParam(value)),
        );
        return { data: null, error: null };
      }

      if (this.rows.length === 0) return { data: [], error: null };
      // Prisma generates ids client-side (@default(uuid())), so the column
      // often has no database default; mirror that for inserts.
      const idColumn = columns.get('id');
      const rows = this.rows.map((row) =>
        idColumn && !idColumn.hasDefault && row.id === undefined
          ? { id: randomUUID(), ...row }
          : row,
      );
      const names = [...new Set(rows.flatMap((row) => Object.keys(row)))];
      const values: (string | null)[] = [];
      const tuples = rows.map(
        (row) =>
          `(${names
            .map((name) => {
              values.push(toParam(row[name]));
              return `$${values.length}::${typeOf(name)}`;
            })
            .join(', ')})`,
      );
      const updatable = names.filter(
        (name) => name !== 'id' && !this.conflict.includes(name),
      );
      const onConflict = this.conflict.length
        ? ` ON CONFLICT (${this.conflict.map(quote).join(', ')}) ${
            updatable.length
              ? `DO UPDATE SET ${updatable
                  .map((name) => `${quote(name)} = EXCLUDED.${quote(name)}`)
                  .join(', ')}`
              : 'DO NOTHING'
          }`
        : '';
      const result = await this.prisma.$queryRawUnsafe<{ v: unknown }[]>(
        `INSERT INTO ${table} AS t (${names.map(quote).join(', ')})
         VALUES ${tuples.join(', ')}${onConflict}
         RETURNING to_jsonb(t) AS v`,
        ...values,
      );
      const data = result.map((row) => row.v);
      if (this.wantSingle) {
        return data.length === 1
          ? { data: data[0], error: null }
          : failure(`Expected a single row, got ${data.length}`);
      }
      return {
        data: this.rowLimit === null ? data : data.slice(0, this.rowLimit),
        error: null,
      };
    } catch (error) {
      return failure(error);
    }
  }
}
