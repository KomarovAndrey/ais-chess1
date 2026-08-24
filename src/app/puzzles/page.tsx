import { redirect } from "next/navigation";

/** Legacy /puzzles → /zadachi (Задачи) */
export default function PuzzlesRedirectPage() {
  redirect("/zadachi");
}
