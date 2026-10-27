import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { SessionConflictError, SessionValidationError } from "./session-errors.js";
import type { Response } from 'express';


@Catch(SessionValidationError, SessionConflictError)
export class SessionErrorFilter implements ExceptionFilter<SessionValidationError | SessionConflictError> {
    catch(error: SessionValidationError | SessionConflictError, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse<Response>();

        if (error instanceof SessionValidationError) {
            response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({
                statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                error: 'Unprocessable Entity',
                message: error.message,
                violations: error.violations
            });
            return;
        }

        response.status(HttpStatus.CONFLICT).json({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: error.message
        });
    }
}
