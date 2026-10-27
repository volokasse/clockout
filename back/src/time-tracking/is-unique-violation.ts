import { QueryFailedError } from "typeorm";

// Check PostGreSQL 23505 error code : unique_violation (unique index refusing a duplicated value)
export const isUniqueViolation = (error: unknown): boolean =>
    error instanceof QueryFailedError
    && (error.driverError as { code?: string } | undefined)?.code === '23505';
