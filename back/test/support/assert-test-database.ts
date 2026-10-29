// Garde-fou : tout code qui efface ou migre la base passe d'abord par ici.
// Deux niveaux : la configuration (avant de se connecter), puis la connexion
// réelle (avant le premier TRUNCATE).

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1'];

export interface TestTarget {
    mode: string | undefined;
    host: string | undefined;
    database: string | undefined;
}

export class UnsafeTestDatabaseError extends Error {
    constructor(reasons: string[]) {
        super(
            `Opération refusée, ce n'est pas une base de test :\n- ${reasons.join('\n- ')}`,
        );
        this.name = 'UnsafeTestDatabaseError';
    }
}

// Niveau 1 : la configuration annonce-t-elle une base de test locale ?
// Toutes les raisons du refus sont listées d'un coup.
export function assertTestConfig({ mode, host, database }: TestTarget): void {
    const reasons: string[] = [];
    if (mode !== 'test')
        reasons.push(`PROJECT_MODE vaut "${mode}" (attendu : "test")`);
    if (!database?.endsWith('_test'))
        reasons.push(`DB_NAME vaut "${database}" (doit se terminer par "_test")`);
    if (!host || !LOCAL_HOSTS.includes(host))
        reasons.push(
            `DB_HOST vaut "${host}" (attendu : ${LOCAL_HOSTS.join(', ')})`,
        );
    if (reasons.length > 0) throw new UnsafeTestDatabaseError(reasons);
}

// Niveau 2 : la base réellement jointe, telle que PostgreSQL la nomme.
// Protège d'une configuration correcte en apparence mais détournée ailleurs.
export async function assertTestConnection(db: {
    query(sql: string): Promise<unknown>;
}): Promise<void> {
    const rows = (await db.query('SELECT current_database() AS name')) as {
        name: string;
    }[];
    const name = rows[0]?.name;
    if (!name?.endsWith('_test')) {
        throw new UnsafeTestDatabaseError([
            `la connexion pointe sur la base "${name}" (doit se terminer par "_test")`,
        ]);
    }
}
