const debug = true;

export const FALLBACK = '__FALLBACK__';
export const CATCH = '__CATCH__';
export const PROXY = '__PROXY__';

async function execTransition(test, transition, input) {
  if (test === CATCH && !transition) {
    throw new TraceError('No global error catch', input);
  }

  if (typeof transition === 'object') {
    let output;
    let name;

    if (typeof transition.process === 'function') {
      const args = test instanceof RegExp && typeof input === 'string' ? input.match(test) || [] : [input];
      const res = await transition.process(...args);
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

  return null;
}

async function findAndExecTransitions(state, input) {
  const transitions = state.transitions;
  if (typeof transitions === 'object') {
    for (const [key, transition] of Object.entries(transitions)) {
      console.log(` · Test ${key}`);

      const test = transition.test;
      const tests = Array.isArray(test) ? test : [test];

      let pass = !!test || key === FALLBACK;
      for (const t of tests) {
        if (typeof t === 'function') {
          pass &= await t(input);
        } else if (typeof t === 'boolean') {
          pass &= t;
        } else if (t instanceof RegExp) {
          pass &= typeof input === 'string' && t.test(input);
        } else if (t !== CATCH) {
          pass &= true;
        }
      }

      if (pass) {
        console.log(` ✓ Pass ${key}`);
        try {
          const response = await execTransition(transition.test, transition, input);
          if (response && (response.output || response.next)) {
            return response;
          }
        } catch (e) {
          console.error(e);

          const caught = transitions[CATCH];
          if (caught) {
            return await execTransition(CATCH, caught, e);
          }

          throw e;
        }
      }
    }
  }

  return null;
}

// if a state does not provide an output; the transitionTo will be executed immediately
// else, it will wait for the next transition
export async function step(states, last, input) {
  let output = null;
  let next = null;
  let state = states[PROXY];

  // check the proxy
  if (state) {
    if (debug) console.log('Attempt PROXY.transitions');

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.log('Attempt transitionTo', next);

      try {
        attempt = await execTransition(next, state, input);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e);
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
    if (debug) console.log('Attempt LAST_STATE.transitions');

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next || next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.log('Attempt transitionTo', next);

      try {
        attempt = await execTransition(next, state, input);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e);
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
    if (debug) console.log('Attempt FALLBACK.transitions');

    let attempt;

    try {
      attempt = await findAndExecTransitions(state, input);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.log('Attempt transitionTo', next);

      try {
        attempt = await execTransition(next, state, input);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e);
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
    if (debug) console.log('Attempt LAST_STATE.process', next);

    let attempt;

    try {
      attempt = await execTransition(next, state, input);
    } catch (e) {
      attempt = await execTransition(CATCH, states[CATCH], e);
    }

    if (attempt) {
      output = attempt.output;
      next = attempt.next || next;
    }

    state = states[next];

    // check for an output
    if (!output && next && state) {
      if (debug) console.log('Attempt transitionTo', next);

      try {
        attempt = await execTransition(next, state, input);
      } catch (e) {
        attempt = await execTransition(CATCH, states[CATCH], e);
      }

      if (attempt) {
        output = attempt.output;
        next = attempt.next || next;
      }
    }
  }

  if (debug) console.log(`Stepped ${last} → ${next}`);
  if (debug) console.log('Output', output);

  return {next, output};
}
