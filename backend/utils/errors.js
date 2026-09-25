export const httpError = (status, code, message) =>
  Object.assign(new Error(message), { status, code, expose: true });

export const unauthorized = () =>
  httpError(401, "UNAUTHORIZED", "Authentication required.");
