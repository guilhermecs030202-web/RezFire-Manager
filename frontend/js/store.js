// js/store.js
// Simple pub/sub store with persistence in localStorage

export const store = (() => {
  const listeners = {};

  // Keys we want to persist
  const persistentKeys = ["pedidos", "entregas", "movimentacoes", "produtos"];

  // Load persisted data (if any) or initialise empty arrays
  const state = {};
  persistentKeys.forEach((key) => {
    const raw = localStorage.getItem("rezfire_" + key);
    try {
      state[key] = raw ? JSON.parse(raw) : [];
    } catch {
      state[key] = [];
    }
  });

  const save = (key) => {
    if (persistentKeys.includes(key)) {
      localStorage.setItem("rezfire_" + key, JSON.stringify(state[key]));
    }
  };

  return {
    // Public state (read‑only reference; modify via setState)
    state,

    // Register a listener for an event name
    on: (event, fn) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },

    // Emit an event with optional payload
    emit: (event, payload) => {
      (listeners[event] ?? []).forEach((fn) => fn(payload));
    },

    // Update a piece of state and persist it
    setState: (key, value) => {
      store.state[key] = value;
      save(key);
      store.emit(`state:${key}`, value);
    },
  };
})();

