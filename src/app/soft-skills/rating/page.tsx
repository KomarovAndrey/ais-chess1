import { redirect } from "next/navigation";

export default function SoftSkillsRatingPage() {
  redirect("/ratings?view=overall");
}
