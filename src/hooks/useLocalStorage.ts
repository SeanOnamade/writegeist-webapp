import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  // Get value from localStorage or use initial value
  const [value, setValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initial;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initial;
    }
  });

  // Update localStorage when value changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, value]);

  return [value, setValue];
} 