import prefix from 'react-prefixr';
import tapInject from 'react-tap-event-plugin';

export function ifcat(base, obj) {
  let res = '';
  if (arguments.length > 1) { // eslint-disable-line
    res = `${base} `;
  } else {
    obj = base;
  }

  for (const [cls, pred] of Object.entries(obj)) {
    if (pred) res += ` ${cls}`;
  }

  return res;
}

export function ifel(predicate, b, c) {
  return !!predicate ? b : c;
}

export function pre(o) {
  return prefix(o);
}

export function apply(elem, styles) {
  for (const [prop, val] of Object.entries(styles)) {
    elem.style[prop] = val;
  }
}

export const IS_IOS = /iPad|iPhone|iPod/.test(navigator.platform);

export function useTouchEventsForClick() {
  if (IS_IOS) {
    tapInject();
  }
}

export function onClick(a) {
  return IS_IOS ? {onTouchTap: a} : {onClick: a};
}
