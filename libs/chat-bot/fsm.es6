import IterableWeakMap from '../IterableWeakMap.es6';

const debug = true;

// compatible with both Maps and WeakMaps
class FSMReserved {
  constructor(name) {
    this.name = name;
  }

  toString() {
    return this.name;
  }
}

export const FALLBACK = new FSMReserved('__FALLBACK__');
export const CATCH = new FSMReserved('__CATCH__');
export const PROXY = new FSMReserved('__PROXY__');

async function execTransition(key, transition, input, context = {}) {
  if (key === CATCH && !transition) {
    throw new TraceError('No global error catch', input);
  }

  if (typeof transition === 'object') {
    let output;
    let name;

    if (typeof transition.process === 'function') {
      const res = await transition.process.bind(context)
      (...(key === CATCH || typeof key === 'function' ? [input] : input.match(key) || []));
      if (typeof res === 'string') {
        output = res;
      } else if (res && typeof res === 'object') {
        output = res.output;
        name = res.transitionTo;
      }
    }

    if (typeof transition === 'object' && 'transitionTo' in transition && !name) {
      name = transition.transitionTo;
    }

    return {output, next: name};
  }
}

async function findAndExecTransitions(state, input, context = {}) {
  const transitions = state.transitions;
  if (transitions instanceof IterableWeakMap) {
    for (const key of transitions.keys()) {
      const transition = transitions.get(key);
      console.log('Testing...', key);

      let pass;
      if (typeof key === 'function') {
        pass = await key(input);
      } else if (key instanceof RegExp) {
        pass = key.test(input);
      } else if (key !== CATCH) {
        pass = true;
      }

      if (pass) {
        console.log('Passing...', key);
        try {
          const response = await execTransition(key, transition, input, context);
          if (response && (response.output || response.next)) {
            return response;
          }
        } catch (e) {
          console.tag('FSM').error(e);

          const caught = transitions.get(CATCH);
          if (caught) {
            return await execTransition(CATCH, caught, e, context);
          }

          throw e;
        }
      }
    }
  }
}

// if a state does not provide an output; the transitionTo will be executed immediately
// else, it will wait for the next transition
export async function step(states, last, input, context = {}) {
  const {botname} = context.constructor;

  let output = null;
  let next = null;
  let state = states[PROXY];

  // check the proxy
  if (state) {
    if (debug) console.tag(botname).log('Attempt PROXY.transitions');

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input, context);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e, context);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.tag(botname).log('Attempt transitionTo');

      try {
        attempt = await execTransition(next, state, input, context);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e, context);
      }

      if (attempt) {
        output = attempt.output;
        next = attempt.next || next;
      }
    }
  }

  state = states[last];

  // check last state transition options
  if (!next && !output && state) {
    if (debug) console.tag(botname).log('Attempt LAST_STATE.transitions', state);

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input, context);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e, context);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next || next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.tag(botname).log('Attempt transitionTo');

      try {
        attempt = await execTransition(next, state, input, context);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e, context);
      }

      if (attempt) {
        output = attempt.output;
        next = attempt.next || next;
      }
    }
  }

  state = states[FALLBACK];

  // fallback the global FALLBACK
  if (!next && !output && state) {
    if (debug) console.tag(botname).log('Attempt FALLBACK.transitions');

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input, context);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e, context);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.tag(botname).log('Attempt transitionTo');

      try {
        attempt = await execTransition(next, state, input, context);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e, context);
      }

      if (attempt) {
        output = attempt.output;
        next = attempt.next || next;
      }
    }
  }

  // keep the same
  if (!next) {
    next = last;
  }

  state = states[next];

  // rerun the existing state
  if (!output && next && state) {
    if (debug) console.tag(botname).log('Attempt LAST_STATE.process');

    let attempt;

    try {
      attempt = await execTransition(next, state, input, context);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e, context);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next || next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.tag(botname).log('Attempt transitionTo');

      try {
        attempt = await execTransition(next, state, input, context);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e, context);
      }

      if (attempt) {
        output = attempt.output;
        next = attempt.next || next;
      }
    }
  }

  if (debug) console.tag('fsm').log(botname, last, '->', next, output);

  return {next, output};
}
