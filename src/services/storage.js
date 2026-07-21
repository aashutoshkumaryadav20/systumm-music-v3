export function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn(
      `Could not read "${key}" from storage:`,
      error
    );

    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );

    return true;
  } catch (error) {
    console.warn(
      `Could not save "${key}" to storage:`,
      error
    );

    return false;
  }
}

export function removeStoredValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage restrictions.
  }
}
