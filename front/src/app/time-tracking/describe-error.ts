import { HttpErrorResponse } from "@angular/common/http";


const UNREACHABLE = new Set([0, 502, 503, 504]);

export function describeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (UNREACHABLE.has(error.status)) {
      return "Serveur injoignable. Vérifiez que l'API est démarrée et la connexion.";
    }
    if (error.status === 409) {
      return "Cette action n'est plus possible dans l'état actuel. Les données ont été rechargées.";
    }
    if (error.status === 400) {
      return "Le serveur a refusé la requête.";
    }
    if (error.status === 404) {
      return "Cette session n'existe plus.";
    }
    if (error.status === 422) {
      return "Les horaires saisis sont incohérents.";
    }
  }
  return "Une erreur inattendue est survenue.";
}
