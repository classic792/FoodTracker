export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An unexpected error occurred.";
  if (err.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    message = "Request body must be valid JSON.";
  } else if (err.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large.";
  } else if (
    err.expose === true &&
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500 &&
    typeof err.code === "string"
  ) {
    ({ status, code, message } = err);
  }
  if (status === 500)
    console.error("Unhandled request failure", { method: req.method, status });
  res.status(status).json({ error: { code, message } });
};
