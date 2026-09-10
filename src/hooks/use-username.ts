import { nanoid } from "nanoid";
import { useState } from "react";

const ANIMALS = ["lion", "tiger", "bear", "wolf", "fox"];
// To persist username across sessions or page reloads
const STORAGE_KEY = "chat_username";

const generateUsername = () => {
  const word = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `anonymous-${word}-${nanoid(5)}`; // generating unique username using nanoid package
};

export const useUsername = () => {
  const [username] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    const generated = generateUsername();
    localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  });

  return { username };
};
