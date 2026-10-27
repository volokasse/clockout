import { Violation } from "./session-validation.js";

export class SessionValidationError extends Error {
    constructor(readonly violations: Violation[]) {
        super(`Invalid session: ${violations.map((v) => v.code).join(', ')}`);
        this.name = 'SessionValidationError';
    }
}

export class SessionConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SessionConflictError';
    }
}
