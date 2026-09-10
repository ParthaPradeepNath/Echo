import { nanoid } from "nanoid";
import { useSyncExternalStore } from "react";

const ANIMALS = ["lion", "tiger", "bear", "wolf", "fox"];
// To persist username across sessions or page reloads
const STORAGE_KEY = "chat_username";

const generateUsername = () => {
  const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${word}-${nanoid(5)}`; // generating unique username using nanoid package
};

// Read snapshot from localStorage, generating and persisting one if absent.
// Returns a stable value after the first call, so React re-renders are safe.
const getUsernameSnapshot = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;

  const generated = generateUsername();
  localStorage.setItem(STORAGE_KEY, generated);
  return generated;
};

const EMPTY_USERNAME = "";
const subscribe = () => () => {};

export const useUsername = () => {
  const username = useSyncExternalStore(
    subscribe,
    getUsernameSnapshot,
    () => EMPTY_USERNAME, // server snapshot (SSR/prerender: no localStorage)
  );

  return { username };
};