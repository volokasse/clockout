import { ExceptionFilter, HttpStatus, Catch, ArgumentsHost } from "@nestjs/common";
import { Response } from 'express';
import { InvalidTransitionError } from "./session-transitions.js";

@Catch(InvalidTransitionError)
export class InvalidTransitionFilter implements ExceptionFilter<InvalidTransitionError> {
    catch(error: InvalidTransitionError, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse<Response>();
        response.status(HttpStatus.CONFLICT).json({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: error.message,
            action: error.action,
            from: error.from
        });
    }
}
