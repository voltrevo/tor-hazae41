/**
 * Gets detailed error information including stack traces and causes.
 * Useful for verbose logging and debugging.
 */
export function getErrorDetails(error: unknown): string {
  if (!(error instanceof Error)) {
    let className = '';
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      className = (error as any).constructor.name;
    } catch {
      //
    }

    const prefix = className ? `${className} ` : '';

    return `${prefix}${JSON.stringify(error)}`;
  }

  let msg: string;

  if (error.stack) {
    const includesName = error.stack.includes(error.name);
    const includesMsg = error.stack.includes(error.message);

    if (includesName && includesMsg) {
      msg = error.stack;
    } else if (includesMsg) {
      msg = `${error.name}: ${error.stack}`;
    } else {
      msg = `${error.name}: ${error.message}\nStack: ${error.stack}`;
    }
  } else {
    msg = `${error.name}: ${error.message}`;
  }

  if (error.cause) {
    msg += `\nCause: ${getErrorDetails(error.cause)}`;
  }

  return msg;
}
