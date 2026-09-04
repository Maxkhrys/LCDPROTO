import type { ExpressionRecipe } from "./types";
import { CORE_EXPRESSIONS } from "./coreExpressions";

const STORAGE_KEY = "lcdproto_custom_expressions_v2";

export function loadCustomExpressions(): ExpressionRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((e) => ({ ...e, isCustom: true, category: "custom" }));
    }
  } catch (err) {
    console.error("Failed to parse custom expressions from localStorage:", err);
  }
  return [];
}

export function saveCustomExpression(recipe: ExpressionRecipe): void {
  if (typeof window === "undefined") return;
  const current = loadCustomExpressions();
  const existingIndex = current.findIndex((e) => e.id === recipe.id);
  const updatedRecipe = { ...recipe, isCustom: true, category: "custom" as const };

  let updatedList: ExpressionRecipe[];
  if (existingIndex >= 0) {
    updatedList = [...current];
    updatedList[existingIndex] = updatedRecipe;
  } else {
    updatedList = [...current, updatedRecipe];
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Failed to save custom expression to localStorage:", err);
  }
}

export function deleteCustomExpression(id: string): void {
  if (typeof window === "undefined") return;
  const current = loadCustomExpressions();
  const updatedList = current.filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  } catch (err) {
    console.error("Failed to delete custom expression from localStorage:", err);
  }
}

export function getAllAvailableExpressions(): ExpressionRecipe[] {
  const custom = loadCustomExpressions();
  return [...CORE_EXPRESSIONS, ...custom];
}

export function exportExpressionsToJson(recipes: ExpressionRecipe[]): string {
  return JSON.stringify(recipes, null, 2);
}

export function importExpressionsFromJson(jsonStr: string): ExpressionRecipe[] {
  try {
    const parsed = JSON.parse(jsonStr);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter(
      (item): item is ExpressionRecipe =>
        Boolean(item && item.id && item.leftEye && item.rightEye && item.mouth)
    );
  } catch (err) {
    console.error("Failed to parse imported expressions JSON:", err);
    return [];
  }
}

export function recipeToTypeScript(recipe: ExpressionRecipe): string {
  const cleanId = recipe.id.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return `export const ${cleanId}_EXPRESSION: ExpressionRecipe = ${JSON.stringify(
    recipe,
    null,
    2
  )};`;
}
