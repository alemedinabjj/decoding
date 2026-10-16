import type { Metadata } from "next";
import { IrisWorkspace } from "@/components/iris/iris-workspace";

export const metadata: Metadata = { title: "Iris" };

export default function IrisPage() {
  return <IrisWorkspace />;
}
