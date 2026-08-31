import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Soft Skills",
  description: "Оценки и комментарии по детям, недели 31–40, программы Lumo / Robo / Sport / 3D.",
};

export default function ChildrenLayout({ children }: { children: ReactNode }) {
  return children;
}
