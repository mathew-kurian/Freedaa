import BaseTraceError from 'trace-error';

export function isNullOrUndefined(a) {
  return typeof a === 'undefined' || a === null;
}

export function isEmpty(a) {
  return isNullOrUndefined(a) || (typeof a === 'string' && !a.trim().length);
}

export class TraceError extends BaseTraceError {
  toJSON() {
    const stack = this.stack;
    return {TraceError: stack.substring(stack.indexOf(':') + 2)};
  }
}

export function stripUndefNull(obj) {
  for (const k in obj) {
    if (obj.hasOwnProperty(k)) {
      if (isNullOrUndefined(obj[k])) {
        delete obj[k];
      }
    }
  }

  return obj;
}
