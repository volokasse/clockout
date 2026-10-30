// Redirige /api vers le back de test (même port que dans playwright.config.ts).
module.exports = {
    '/api/**': {
        target: `http://127.0.0.1:${process.env.API_PORT}`,
        secure: false,
    },
};
